class BrokerConnectionState {
    constructor(brokerId, brokerUrl) {
        this.brokerId = brokerId;
        this.brokerUrl = brokerUrl;
        this.status = 'DISCONNECTED'; // CONNECTED, DISCONNECTED, OFFLINE, ERROR
        this.lastConnected = null;
        this.lastDisconnected = null;
        this.lastError = null;
        this.lastErrorTime = null;
        this.connectionAttempts = 0;
        this.successfulConnections = 0;
        this.messageCount = 0;
        this.errorCount = 0;
        this.lastHeartbeat = Date.now();
    }

    connect() {
        this.status = 'CONNECTED';
        this.connectionAttempts++;
        this.successfulConnections++;
        this.lastConnected = new Date().toISOString();
        this.lastHeartbeat = Date.now();
    }

    disconnect() {
        this.status = 'DISCONNECTED';
        this.lastDisconnected = new Date().toISOString();
    }

    offline() {
        this.status = 'OFFLINE';
    }

    error(err) {
        this.status = 'ERROR';
        this.lastError = err?.message || String(err);
        this.lastErrorTime = new Date().toISOString();
        this.errorCount++;
    }

    recordMessage() {
        this.messageCount++;
        this.lastHeartbeat = Date.now();
    }

    isHealthy() {
        return this.status === 'CONNECTED' && 
               (Date.now() - this.lastHeartbeat < 120000); // 2 minute heartbeat window
    }

    toJSON() {
        return {
            id: this.brokerId,
            url: this.brokerUrl,
            status: this.status,
            healthy: this.isHealthy(),
            metrics: {
                messageCount: this.messageCount,
                connectionAttempts: this.connectionAttempts,
                errorCount: this.errorCount
            },
            timestamps: {
                lastConnected: this.lastConnected,
                lastDisconnected: this.lastDisconnected,
                lastErrorTime: this.lastErrorTime,
                lastHeartbeat: new Date(this.lastHeartbeat).toISOString()
            },
            lastError: this.lastError
        };
    }
}

module.exports = BrokerConnectionState;
