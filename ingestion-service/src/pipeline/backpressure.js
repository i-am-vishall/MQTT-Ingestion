/**
 * Circuit Breaker / Backpressure Controller
 * 
 * Purpose: Prevent system collapse under extreme load by shedding
 * non-critical events when Redis Stream fills up.
 * 
 * States:
 *   GREEN  - Accept everything (normal operation)
 *   YELLOW - Accept critical events only (shed parking, keepalive)
 *   RED    - Stop accepting entirely (unsubscribe from MQTT)
 * 
 * Critical events (NEVER dropped in YELLOW):
 *   ANPR, INTRUSION_DETECTION, FIRE, CROWD, Face_Recognition
 */

const createLogger = require('../../utils/createLogger');
const logger = createLogger('backpressure');

// Critical event types — these are life-safety and enforcement data
const CRITICAL_EVENT_TYPES = new Set([
    'ANPR',
    'INTRUSION_DETECTION',
    'FIRE',
    'CROWD',
    'Face_Recognition',
    'FaceRecognition',
    'INTRUSION',
    'FIRE_DETECTION'
]);

class CircuitBreaker {
    /**
     * @param {Object} redis - ioredis client instance
     * @param {Object} config - { streamName, yellowThreshold, redThreshold }
     */
    constructor(redis, config = {}) {
        this.redis = redis;
        this.streamName = config.streamName || 'mqtt:ingest';

        // Thresholds (based on stream entry count)
        this.yellowThreshold = config.yellowThreshold || 1000000;  // 1M entries
        this.redThreshold = config.redThreshold || 2500000;        // 2.5M entries

        // State
        this.state = 'GREEN';
        this.dropRate = 0;        // 0 = accept all, 1.0 = drop all non-critical
        this.streamLength = 0;
        this.lastCheck = 0;
        this.checkIntervalMs = config.checkIntervalMs || 2000;

        // Callbacks for RED/GREEN transitions (wired by index.js)
        this.onRedCallback = null;
        this.onGreenCallback = null;

        this._startMonitor();
    }

    /**
     * Check if an event should be accepted or shed
     * @param {Object} event - { event_type, camera_id, ... }
     * @returns {boolean} true = accept, false = shed
     */
    shouldAccept(event) {
        if (this.state === 'GREEN') return true;

        // Critical events ALWAYS pass through — even in YELLOW
        const eventType = event?.event_type || event?.normalized?.event_type || '';
        if (CRITICAL_EVENT_TYPES.has(eventType)) return true;

        // RED: reject all non-critical
        if (this.state === 'RED') return false;

        // YELLOW: probabilistic shedding of non-critical
        return Math.random() > this.dropRate;
    }

    /**
     * Periodically check Redis stream pressure and update state
     */
    async _checkPressure() {
        try {
            const len = await this.redis.xlen(this.streamName);
            this.streamLength = len;
            const prevState = this.state;

            if (len >= this.redThreshold) {
                this.state = 'RED';
                this.dropRate = 1.0;
            } else if (len >= this.yellowThreshold) {
                this.state = 'YELLOW';
                // Linear scale: 0% drop at yellow threshold → 90% at red threshold
                const pressure = (len - this.yellowThreshold) /
                                 (this.redThreshold - this.yellowThreshold);
                this.dropRate = Math.min(pressure * 0.9, 0.9);
            } else {
                this.state = 'GREEN';
                this.dropRate = 0;
            }

            // Log state transitions
            if (this.state !== prevState) {
                if (this.state === 'RED') {
                    logger.error({
                        event: 'circuit_breaker_state_change',
                        from: prevState, to: 'RED',
                        streamLength: len,
                        dropRate: '100%'
                    }, `CIRCUIT BREAKER RED: Stream at ${len} entries — shedding ALL non-critical`);

                    // Fire RED callback (MQTT unsubscribe)
                    if (this.onRedCallback) {
                        try { this.onRedCallback(); } catch (e) { /* ignore */ }
                    }

                } else if (this.state === 'YELLOW') {
                    logger.warn({
                        event: 'circuit_breaker_state_change',
                        from: prevState, to: 'YELLOW',
                        streamLength: len,
                        dropRate: (this.dropRate * 100).toFixed(0) + '%'
                    }, `CIRCUIT BREAKER YELLOW: Stream at ${len} entries — shedding non-critical`);

                } else if (this.state === 'GREEN') {
                    logger.info({
                        event: 'circuit_breaker_state_change',
                        from: prevState, to: 'GREEN',
                        streamLength: len
                    }, 'CIRCUIT BREAKER GREEN: System recovered — accepting all events');

                    // Fire GREEN callback (MQTT re-subscribe)
                    if (this.onGreenCallback) {
                        try { this.onGreenCallback(); } catch (e) { /* ignore */ }
                    }
                }
            }
        } catch (e) {
            // Redis might be down — TieredBuffer handles this
            // Don't change state based on failed check
        }
    }

    _startMonitor() {
        this._monitorInterval = setInterval(() => this._checkPressure(), this.checkIntervalMs);
        // Also check immediately on start
        this._checkPressure();
    }

    /**
     * Get circuit breaker status for health endpoint
     */
    getStatus() {
        return {
            state: this.state,
            dropRate: (this.dropRate * 100).toFixed(1) + '%',
            streamLength: this.streamLength,
            yellowThreshold: this.yellowThreshold,
            redThreshold: this.redThreshold
        };
    }

    destroy() {
        if (this._monitorInterval) {
            clearInterval(this._monitorInterval);
        }
    }
}

module.exports = CircuitBreaker;
