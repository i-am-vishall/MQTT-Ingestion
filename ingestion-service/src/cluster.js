const cluster = require('cluster');
const config = require('./config');
const createLogger = require('../utils/createLogger');
const logger = createLogger('cluster-master');

if (cluster.isPrimary) {
    const minWorkers = config.service.minWorkers || 2;
    const maxWorkers = config.service.maxWorkers || 12;
    const batchSize = config.service.batchSize || 2000;
    
    // We start at minimum to save RAM initially
    let targetWorkers = minWorkers;
    let intentionalKill = false; // Flag to prevent auto-respawn during downscale

    logger.info('===================================================');
    logger.info(`STARTING ELASTIC AUTO-SCALING CLUSTER`);
    logger.info(`MIN_WORKERS: ${minWorkers} | MAX_WORKERS: ${maxWorkers}`);
    logger.info('===================================================');

    // If Shock Absorber (Redis) mode is disabled, we don't have streams.
    // We just spawn maxWorkers statically to handle direct DB throughput.
    if (!config.service.shockAbsorberMode) {
        logger.info(`SHOCK ABSORBER MODE OFF: Bypassing elastic scaler and fixing workers at ${maxWorkers}`);
        targetWorkers = maxWorkers;
    }

    // Spawn initial minimum (or static target)
    for (let i = 0; i < targetWorkers; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        if (intentionalKill) {
            intentionalKill = false;
            logger.info(`Worker ${worker.process.pid} successfully retired (Downscale). Active: ${Object.keys(cluster.workers).length}`);
            return; // Don't respawn if we killed it intentionally
        }
        
        logger.warn(`Worker ${worker.process.pid} crashed unexpectedly! Auto-respawning to maintain engine...`);
        cluster.fork();
    });

    // ── STRICT MODE SEPARATION ────────────────────────────────────────────
    // SHOCK_ABSORBER_MODE=true  → Redis ON,  Elastic Scaler ON
    // SHOCK_ABSORBER_MODE=false → Redis OFF, Static Workers ONLY
    // Redis and Direct Mode CANNOT run simultaneously.
    if (config.service.shockAbsorberMode) {
        logger.info('SHOCK ABSORBER MODE: Connecting to Redis for elastic scaling and health reporting...');

        const Redis = require('ioredis');
        const redis = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            lazyConnect: true
        });

        redis.connect().then(async () => {
            logger.info('Redis connected — Elastic Scaler is ACTIVE.');

            // Apply memory policy from .env if present
            if (process.env.REDIS_MAX_MEMORY) {
                await redis.config('SET', 'maxmemory', process.env.REDIS_MAX_MEMORY)
                    .catch(err => logger.warn('Failed to set redis maxmemory.'));
            }
            if (process.env.REDIS_EVICTION_POLICY) {
                await redis.config('SET', 'maxmemory-policy', process.env.REDIS_EVICTION_POLICY)
                    .catch(err => logger.warn('Failed to set redis eviction policy.'));
            }

            redis.set('mqtt:active_cluster_workers', Object.keys(cluster.workers).length);

            setInterval(async () => {
                try {
                    const activeWorkers = Object.keys(cluster.workers).length;
                    redis.set('mqtt:active_cluster_workers', activeWorkers);

                    // Auto-Scaler Brain
                    const pendingData = await redis.xpending(config.stream.name, config.stream.consumerGroup);
                    const pendingCount = pendingData ? pendingData[0] : 0;
                    const capacity = activeWorkers * batchSize;

                    if (pendingCount >= capacity * 0.8 && activeWorkers < maxWorkers) {
                        logger.info(`HEAVY LOAD: Pending (${pendingCount}) >= 80% Capacity (${capacity}). Scaling UP → ${activeWorkers + 1} workers`);
                        targetWorkers++;
                        cluster.fork();
                    } else if (pendingCount < capacity * 0.2 && activeWorkers > minWorkers) {
                        logger.debug(`LOW LOAD: Pending (${pendingCount}) < 20% Capacity (${capacity}). Scaling DOWN → ${activeWorkers - 1} workers`);
                        targetWorkers--;
                        const workerIds = Object.keys(cluster.workers);
                        if (workerIds.length > 0) {
                            const victim = cluster.workers[workerIds[workerIds.length - 1]];
                            intentionalKill = true;
                            victim.disconnect();
                        }
                    }
                } catch (err) {
                    logger.error({ err: err.message }, 'Elastic Scaler error.');
                }
            }, 5000);

        }).catch(err => {
            logger.error({ err: err.message }, 'SHOCK ABSORBER MODE: Redis connection FAILED. Elastic Scaler disabled.');
        });

    } else {
        // DIRECT MODE: No Redis. Log worker count to stdout only.
        logger.info(`DIRECT MODE: Redis is DISABLED. Running ${maxWorkers} static workers for maximum direct DB throughput.`);
        setInterval(() => {
            const activeWorkers = Object.keys(cluster.workers).length;
            logger.debug({ activeWorkers }, 'Direct Mode — Active Workers');
        }, 30000);
    }

} else {
    // WORKER PROCESS LOGIC
    // Modify MQTT topics to use load-balanced Shared Subscriptions across the workers
    const originalTopics = config.mqtt.topics;
    config.mqtt.topics = originalTopics.map(t => {
        if(!t.startsWith('$share/')) {
            const os = require('os');
            const uniqueGroup = `ingest_${os.hostname().replace(/[^a-zA-Z0-9]/g, '_')}`;
            return `$share/${uniqueGroup}/${t}`;
        }
        return t;
    });

    require('./index.js');
}
