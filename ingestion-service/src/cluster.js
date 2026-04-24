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

    // Auto-Scaler Brain Loop - ONLY IF SHOCK ABSORBER MODE IS ON
    if (config.service.shockAbsorberMode) {
        const Redis = require('ioredis');
        const redis = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            lazyConnect: true
        });

        redis.connect().then(async () => {
            // Apply memory limits from .env if present
            if (process.env.REDIS_MAX_MEMORY) {
                await redis.config('SET', 'maxmemory', process.env.REDIS_MAX_MEMORY)
                           .catch(err => logger.warn('Failed to set redis maxmemory. Check if Redis allows CONFIG command.'));
            }
            if (process.env.REDIS_EVICTION_POLICY) {
                await redis.config('SET', 'maxmemory-policy', process.env.REDIS_EVICTION_POLICY)
                           .catch(err => logger.warn('Failed to set redis eviction policy.'));
            }

            // Expose active worker count to UI dashboard immediately
            redis.set('mqtt:active_cluster_workers', Object.keys(cluster.workers).length);

            setInterval(async () => {
                try {
                    const activeWorkers = Object.keys(cluster.workers).length;
                    redis.set('mqtt:active_cluster_workers', activeWorkers);

                    // Check pending messages (items grabbed by workers but not saved to db yet)
                    const pendingData = await redis.xpending(config.stream.name, config.stream.consumerGroup);
                    const pendingCount = pendingData ? pendingData[0] : 0;

                    // Algorithm:
                    // If the sum of pending messages is nearing the physical capacity of all active workers (80%),
                    // they are saturated. We need to spawn more support!
                    const capacity = activeWorkers * batchSize;
                    
                    if (pendingCount >= capacity * 0.8 && activeWorkers < maxWorkers) {
                        logger.info(`HEAVY LOAD DETECTED: Pending (${pendingCount}) nearing Capacity (${capacity}). Autoscaling UP!`);
                        targetWorkers++;
                        cluster.fork();
                    } 
                    // If there is very little load (under 20% capacity) and we have excess workers burning RAM...
                    else if (pendingCount < capacity * 0.2 && activeWorkers > minWorkers) {
                        logger.debug(`LOW LOAD DETECTED: Pending (${pendingCount}) far below Capacity (${capacity}). Autoscaling DOWN!`);
                        targetWorkers--;
                        
                        // Find any active worker and gracefully disconnect them
                        const workerIds = Object.keys(cluster.workers);
                        if (workerIds.length > 0) {
                            const victim = cluster.workers[workerIds[workerIds.length - 1]];
                            intentionalKill = true;
                            victim.disconnect(); // Graceful kill
                        }
                    }

                } catch (err) {
                    logger.error({ err: err.message }, 'Auto-scaler encountered an error connecting to Redis or analyzing streams.');
                }
            }, 5000); // Check load every 5 seconds
        }).catch(err => {
            logger.error('Failed to connect primary cluster to Redis for auto-scaling.', err);
        });
    } else {
        logger.info('SHOCK ABSORBER MODE IS OFF: Redis elastic scaling disabled, running statically.');
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
