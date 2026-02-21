/**
 * FIX #2: MQTT SILENT FAILURES (CONNECTION LOSS NOT DETECTED)
 * 
 * PROBLEM:
 * - No reconnection strategy when broker disconnects
 * - No offline handlers
 * - Service appears healthy but receives NO messages
 * - Admins don't know data flow stopped
 * - Health check doesn't report connection status
 * 
 * SOLUTION:
 * - Add connection state tracking
 * - Add offline/disconnect handlers
 * - Implement health check with broker status
 * - Add alerting mechanisms
 * 
 * SEVERITY: CRITICAL - Silent Service Degradation
 */

// ============================================================
// BEFORE (❌ BROKEN CODE)
// ============================================================
/*
client.on('connect', () => {
    logger.info(`STEP 4/6 [${sourceId}]: MQTT Connected!`);
    client.subscribe(config.mqtt.topics, (err) => {
        if (!err) {
            logger.info(`Subscribed to topics...`);
        } else {
            logger.error(err, `Failed to subscribe`);
        }
    });
});

client.on('message', (topic, message) => handleMessage(topic, message, sourceId, sourceIp));
client.on('error', (err) => logger.error(err, `[${sourceId}] Error:`));

// ❌ NO DISCONNECT/OFFLINE/RECONNECT HANDLERS!
// ❌ NO HEALTH CHECK STATUS!
*/

// ============================================================
// AFTER (✅ FIXED CODE)
// ============================================================

const http = require('http');
const mqtt = require('mqtt');

// Global connection state for all brokers
const brokerConnections = new Map();

/**
 * Track connection state for each broker
 */
class BrokerConnectionState {
    constructor(brokerId, brokerUrl) {
        this.brokerId = brokerId;
        this.brokerUrl = brokerUrl;
        this.status = 'DISCONNECTED'; // CONNECTED | DISCONNECTED | OFFLINE | ERROR
        this.lastConnected = null;
        this.lastError = null;
        this.connectionAttempts = 0;
        this.lastHeartbeat = Date.now();
        this.messageCount = 0;
        this.errorCount = 0;
    }

    connect() {
        this.status = 'CONNECTED';
        this.lastConnected = Date.now();
        this.connectionAttempts = 0;
        this.errorCount = 0;
    }

    disconnect(reason) {
        this.status = 'DISCONNECTED';
        this.lastError = reason;
    }

    offline() {
        this.status = 'OFFLINE';
        this.connectionAttempts++;
    }

    error(errorMessage) {
        this.status = 'ERROR';
        this.lastError = errorMessage;
        this.errorCount++;
    }

    heartbeat() {
        this.lastHeartbeat = Date.now();
        this.messageCount++;
    }

    isHealthy() {
        return this.status === 'CONNECTED' && 
               (Date.now() - this.lastHeartbeat < 60000); // Must have received msg in last 60s
    }

    toJSON() {
        return {
            brokerId: this.brokerId,
            brokerUrl: this.brokerUrl,
            status: this.status,
            lastConnected: this.lastConnected,
            lastError: this.lastError,
            connectionAttempts: this.connectionAttempts,
            messageCount: this.messageCount,
            errorCount: this.errorCount,
            isHealthy: this.isHealthy(),
            lastHeartbeatAgo: Date.now() - this.lastHeartbeat
        };
    }
}

/**
 * Connect to MQTT broker with full error handling
 */
function connectToBroker(brokerUrl, sourceId, sourceIp, index) {
    const connectionState = new BrokerConnectionState(sourceId, brokerUrl);
    brokerConnections.set(sourceId, connectionState);

    logger.info(`[${sourceId}] Attempting connection to ${brokerUrl}...`);

    const client = mqtt.connect(brokerUrl, {
        reconnectPeriod: config.mqtt.reconnectPeriod,
        connectTimeout: 10000,
        clientId: `mqtt-ingestion-${sourceId}-${Date.now()}`,
        clean: true,
        // Add keepalive for detecting dead connections
        keepalive: 30
    });

    // ============================================================
    // EVENT: CONNECT
    // ============================================================
    client.on('connect', () => {
        connectionState.connect();
        logger.info({
            sourceId,
            brokerUrl,
            timestamp: new Date().toISOString()
        }, '✅ MQTT Broker Connected!');

        client.subscribe(config.mqtt.topics, (err) => {
            if (!err) {
                logger.info({
                    sourceId,
                    topics: config.mqtt.topics
                }, `Subscribed to topics`);
            } else {
                logger.error({
                    sourceId,
                    topics: config.mqtt.topics,
                    error: err.message
                }, 'Failed to subscribe to topics');
            }
        });
    });

    // ============================================================
    // EVENT: MESSAGE (with heartbeat tracking)
    // ============================================================
    client.on('message', (topic, message) => {
        try {
            connectionState.heartbeat(); // Update last message time
            handleMessage(topic, message, sourceId, sourceIp);
        } catch (err) {
            logger.error({
                sourceId,
                topic,
                error: err.message
            }, 'Error processing message');
        }
    });

    // ============================================================
    // EVENT: DISCONNECT (intentional or unexpected)
    // ============================================================
    client.on('disconnect', (packet) => {
        const reason = packet?.reasonString || 'Unknown disconnect';
        connectionState.disconnect(reason);
        
        logger.warn({
            sourceId,
            reason,
            packet,
            timestamp: new Date().toISOString()
        }, '⚠️ MQTT Broker Disconnected');
    });

    // ============================================================
    // EVENT: OFFLINE (broker unreachable)
    // ============================================================
    client.on('offline', () => {
        connectionState.offline();
        
        logger.error({
            sourceId,
            connectionAttempts: connectionState.connectionAttempts,
            timestamp: new Date().toISOString()
        }, '🔴 MQTT Broker Offline - Attempting Reconnect');

        // Alert if too many attempts
        if (connectionState.connectionAttempts > 10) {
            logger.fatal({
                sourceId,
                attempts: connectionState.connectionAttempts
            }, 'CRITICAL: Broker repeatedly offline - may be down permanently');
        }
    });

    // ============================================================
    // EVENT: ERROR (connection error)
    // ============================================================
    client.on('error', (err) => {
        connectionState.error(err.message);
        
        logger.error({
            sourceId,
            errorCode: err.code,
            errorMessage: err.message,
            timestamp: new Date().toISOString()
        }, '❌ MQTT Connection Error');

        // Classify errors for better debugging
        if (err.code === 'ECONNREFUSED') {
            logger.error(`[${sourceId}] Connection refused - broker may not be running`);
        } else if (err.code === 'ETIMEDOUT') {
            logger.error(`[${sourceId}] Connection timeout - broker may be unreachable`);
        } else if (err.code === 'ENOTFOUND') {
            logger.error(`[${sourceId}] DNS resolution failed - invalid broker hostname`);
        }
    });

    // ============================================================
    // EVENT: END (connection closed)
    // ============================================================
    client.on('end', () => {
        logger.warn({
            sourceId,
            timestamp: new Date().toISOString()
        }, 'MQTT Connection Ended');
    });

    // ============================================================
    // EVENT: RECONNECT (attempting to reconnect)
    // ============================================================
    client.on('reconnect', () => {
        logger.info({
            sourceId,
            attempt: connectionState.connectionAttempts + 1
        }, 'Attempting to reconnect to MQTT broker');
    });

    clients.push(client);
    return client;
}

// ============================================================
// HEALTH CHECK ENDPOINT (with connection status)
// ============================================================

/**
 * Health check endpoint that includes broker connection status
 */
const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        // Collect all broker statuses
        const brokerStatuses = Array.from(brokerConnections.values()).map(state => state.toJSON());

        // Determine overall health
        const connectedCount = brokerStatuses.filter(b => b.status === 'CONNECTED').length;
        const allHealthy = brokerStatuses.every(b => b.isHealthy);

        const healthData = {
            service: 'mqtt-ingestion',
            status: allHealthy && connectedCount > 0 ? 'HEALTHY' : 'DEGRADED',
            timestamp: new Date().toISOString(),
            stats: {
                totalBrokers: brokerStatuses.length,
                connectedBrokers: connectedCount,
                totalMessagesIngested: totalIngested,
                currentBufferSize: messageBuffer.length,
                memoryUsage: {
                    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
                    rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
                }
            },
            brokers: brokerStatuses,
            alerts: generateAlerts(brokerStatuses)
        };

        res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthData, null, 2));
    } else if (req.url === '/health/brokers') {
        // Detailed broker status only
        const statuses = Array.from(brokerConnections.values()).map(s => s.toJSON());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(statuses, null, 2));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const HEALTH_PORT = process.env.HEALTH_PORT || 3333;
healthServer.listen(HEALTH_PORT, '127.0.0.1', () => {
    logger.info(`Health Monitor listening on http://127.0.0.1:${HEALTH_PORT}/health`);
});

// ============================================================
// ALERTING SYSTEM
// ============================================================

/**
 * Generate alerts based on broker status
 */
function generateAlerts(brokerStatuses) {
    const alerts = [];

    brokerStatuses.forEach(broker => {
        if (broker.status === 'DISCONNECTED') {
            alerts.push({
                level: 'WARNING',
                type: 'BROKER_DISCONNECTED',
                broker: broker.brokerId,
                message: `Broker ${broker.brokerId} is disconnected`,
                timestamp: new Date().toISOString()
            });
        }

        if (broker.status === 'OFFLINE') {
            alerts.push({
                level: 'CRITICAL',
                type: 'BROKER_OFFLINE',
                broker: broker.brokerId,
                message: `Broker ${broker.brokerId} is offline (${broker.connectionAttempts} attempts)`,
                timestamp: new Date().toISOString()
            });
        }

        if (broker.status === 'ERROR') {
            alerts.push({
                level: 'ERROR',
                type: 'BROKER_ERROR',
                broker: broker.brokerId,
                message: `Broker ${broker.brokerId} error: ${broker.lastError}`,
                timestamp: new Date().toISOString()
            });
        }

        if (!broker.isHealthy && broker.status === 'CONNECTED') {
            alerts.push({
                level: 'WARNING',
                type: 'NO_HEARTBEAT',
                broker: broker.brokerId,
                message: `No messages from ${broker.brokerId} in ${broker.lastHeartbeatAgo}ms`,
                timestamp: new Date().toISOString()
            });
        }
    });

    return alerts;
}

// ============================================================
// PERIODIC STATUS LOGGING (every 60 seconds)
// ============================================================

setInterval(() => {
    const statuses = Array.from(brokerConnections.values());
    const summary = {
        totalBrokers: statuses.length,
        connected: statuses.filter(s => s.status === 'CONNECTED').length,
        disconnected: statuses.filter(s => s.status === 'DISCONNECTED').length,
        offline: statuses.filter(s => s.status === 'OFFLINE').length,
        errors: statuses.filter(s => s.status === 'ERROR').length,
        totalMessages: totalIngested
    };

    logger.info(summary, 'Broker Status Summary');

    // Send CRITICAL alert if all brokers down
    if (summary.connected === 0 && summary.totalBrokers > 0) {
        logger.fatal(statuses.map(s => s.toJSON()), 'CRITICAL: All MQTT brokers are unavailable!');
    }
}, 60000);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Close all MQTT clients
    clients.forEach(client => {
        if (client.connected || client.reconnecting) {
            client.unsubscribe(config.mqtt.topics);
            client.end(true);
        }
    });

    // Close health server
    healthServer.close();

    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================
// TESTING
// ============================================================

/**
 * Simulate broker disconnect for testing
 */
function testBrokerDisconnect() {
    if (clients.length > 0) {
        const client = clients[0];
        logger.info('Simulating broker disconnect...');
        client.stream.destroy();
        // Should trigger offline/error handlers
    }
}

module.exports = {
    connectToBroker,
    BrokerConnectionState,
    brokerConnections,
    generateAlerts,
    testBrokerDisconnect
};
