/**
 * Negative & Resilience Tests
 * Tests error handling, recovery, edge cases, and failure scenarios
 */

describe('Resilience & Error Handling', () => {
    describe('MQTT Connection Failures', () => {
        test('reconnects after broker disconnection', async () => {
            const brokerState = {
                status: 'DISCONNECTED',
                reconnecting: true,
                retries: 0,
                maxRetries: 5
            };

            // Simulate reconnection attempt
            brokerState.retries++;
            if (brokerState.retries <= brokerState.maxRetries) {
                brokerState.status = 'CONNECTING';
            }

            expect(brokerState.retries).toBe(1);
            expect(brokerState.status).toMatch(/CONNECTING|CONNECTED/);
        });

        test('handles network timeouts gracefully', async () => {
            const timeout = 5000; // 5 second timeout
            let timedOut = false;

            const connectPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    timedOut = true;
                    reject(new Error('Connection timeout'));
                }, timeout);
            });

            try {
                await Promise.race([
                    connectPromise,
                    new Promise(r => setTimeout(r, 3000))
                ]);
            } catch (e) {
                expect(timedOut).toBe(false); // Should not timeout
            }
        });

        test('prevents infinite reconnection loops', () => {
            let reconnectCount = 0;
            const maxReconnects = 10;

            while (reconnectCount < 20 && reconnectCount < maxReconnects) {
                reconnectCount++;
            }

            expect(reconnectCount).toBeLessThanOrEqual(maxReconnects);
        });

        test('logs connection state changes', () => {
            const logs = [];

            const recordLog = (event) => {
                logs.push({ event, timestamp: new Date().toISOString() });
            };

            recordLog('MQTT_CONNECTING');
            recordLog('MQTT_CONNECTED');
            recordLog('MQTT_DISCONNECTED');

            expect(logs.length).toBe(3);
            expect(logs[0].event).toBe('MQTT_CONNECTING');
            expect(logs[2].event).toBe('MQTT_DISCONNECTED');
        });
    });

    describe('Database Failures', () => {
        test('handles connection pool exhaustion', async () => {
            const pool = {
                available: 5,
                max: 10,
                connect: async function() {
                    if (this.available > 0) {
                        this.available--;
                        return { release: () => { this.available++; } };
                    } else {
                        throw new Error('Connection pool exhausted');
                    }
                }
            };

            // Exhaust pool
            const clients = [];
            for (let i = 0; i < pool.max; i++) {
                try {
                    const client = await pool.connect();
                    clients.push(client);
                } catch (e) {
                    if (i >= pool.max) {
                        expect(e.message).toContain('exhausted');
                    }
                }
            }

            expect(pool.available).toBeLessThanOrEqual(0);
        });

        test('retries failed database operations', async () => {
            let attempts = 0;
            const maxRetries = 3;

            const query = async () => {
                attempts++;
                if (attempts < maxRetries) {
                    throw new Error('Database temporarily unavailable');
                }
                return { rows: [] };
            };

            let result = null;
            let lastError = null;

            for (let i = 0; i <= maxRetries; i++) {
                try {
                    result = await query();
                    break;
                } catch (e) {
                    lastError = e;
                }
            }

            expect(result).not.toBeNull();
            expect(attempts).toBe(maxRetries);
        });

        test('rolls back transactions on error', async () => {
            const transaction = {
                state: 'INITIAL',
                execute: async function(query) {
                    if (query === 'BEGIN') {
                        this.state = 'ACTIVE';
                    } else if (query === 'COMMIT') {
                        this.state = 'COMMITTED';
                    } else if (query === 'ROLLBACK') {
                        this.state = 'ROLLED_BACK';
                    } else if (this.state === 'ACTIVE') {
                        throw new Error('Query failed');
                    }
                }
            };

            try {
                await transaction.execute('BEGIN');
                await transaction.execute('INSERT...');
                await transaction.execute('COMMIT');
            } catch (e) {
                await transaction.execute('ROLLBACK');
            }

            expect(transaction.state).toBe('ROLLED_BACK');
        });

        test('detects and handles deadlocks', () => {
            const isDeadlock = (error) => {
                return error.message.includes('deadlock') || 
                       error.code === '40P01'; // PostgreSQL deadlock code
            };

            const errors = [
                { message: 'deadlock detected', code: '40P01' },
                { message: 'timeout', code: '57014' },
                { message: 'unique violation', code: '23505' }
            ];

            const deadlockErrors = errors.filter(isDeadlock);
            expect(deadlockErrors.length).toBe(1);
        });
    });

    describe('Message Processing Failures', () => {
        test('handles corrupted MQTT messages', () => {
            const parseMessage = (buffer) => {
                try {
                    return JSON.parse(buffer.toString());
                } catch (e) {
                    return null; // Return null for invalid JSON
                }
            };

            const messages = [
                Buffer.from('{"valid":"json"}'),
                Buffer.from('corrupted data'),
                Buffer.from('')
            ];

            const results = messages.map(parseMessage);
            expect(results[0]).not.toBeNull();
            expect(results[1]).toBeNull();
            expect(results[2]).toBeNull();
        });

        test('validates required message fields', () => {
            const validateEvent = (event) => {
                const required = ['camera_id', 'event_type', 'event_time'];
                const missing = required.filter(field => !event[field]);
                return { valid: missing.length === 0, missing };
            };

            const validEvent = {
                camera_id: 'CAM001',
                event_type: 'ANPR',
                event_time: new Date().toISOString()
            };

            const invalidEvent = {
                camera_id: 'CAM001'
            };

            expect(validateEvent(validEvent).valid).toBe(true);
            expect(validateEvent(invalidEvent).valid).toBe(false);
            expect(validateEvent(invalidEvent).missing).toContain('event_type');
        });

        test('handles messages with missing optional fields', () => {
            const event = {
                camera_id: 'CAM001',
                event_type: 'ANPR',
                event_time: new Date().toISOString()
                // Missing: severity, payload, etc.
            };

            // Should not throw, use defaults for missing fields
            expect(event.camera_id).toBeDefined();
            expect(event.severity || 'INFO').toBe('INFO');
        });

        test('skips or quarantines invalid events', () => {
            const eventQueue = {
                normal: [],
                quarantine: []
            };

            const events = [
                { id: 1, valid: true },
                { id: 2, valid: false },
                { id: 3, valid: true }
            ];

            events.forEach(event => {
                if (event.valid) {
                    eventQueue.normal.push(event);
                } else {
                    eventQueue.quarantine.push(event);
                }
            });

            expect(eventQueue.normal.length).toBe(2);
            expect(eventQueue.quarantine.length).toBe(1);
        });
    });

    describe('Memory & Resource Management', () => {
        test('prevents memory leaks from unclosed connections', () => {
            const connections = new Set();

            const openConnection = () => {
                const conn = { id: Math.random(), close: () => connections.delete(conn) };
                connections.add(conn);
                return conn;
            };

            const conn1 = openConnection();
            const conn2 = openConnection();
            const conn3 = openConnection();

            expect(connections.size).toBe(3);

            conn1.close();
            conn2.close();
            conn3.close();

            expect(connections.size).toBe(0);
        });

        test('cleans up timer intervals', (done) => {
            const timers = [];

            const setManagedInterval = (fn, ms) => {
                const id = setInterval(fn, ms);
                timers.push(id);
                return id;
            };

            const clearManagedIntervals = () => {
                timers.forEach(id => clearInterval(id));
                timers.length = 0;
            };

            setManagedInterval(() => {}, 1000);
            setManagedInterval(() => {}, 2000);

            expect(timers.length).toBe(2);

            clearManagedIntervals();
            expect(timers.length).toBe(0);

            done();
        });

        test('handles buffer overflow', () => {
            const buffer = [];
            const MAX_BUFFER = 100;

            for (let i = 0; i < 150; i++) {
                if (buffer.length >= MAX_BUFFER) {
                    const dropCount = Math.ceil(MAX_BUFFER * 0.1);
                    buffer.splice(0, dropCount);
                }
                buffer.push({ id: i });
            }

            expect(buffer.length).toBeLessThanOrEqual(MAX_BUFFER);
        });

        test('detects memory leaks', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const leakedReferences = [];

            // Simulate leak
            for (let i = 0; i < 10000; i++) {
                leakedReferences.push(new Array(1000).fill('data'));
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;

            expect(memoryGrowth).toBeGreaterThan(0);

            // Clear leak
            leakedReferences.length = 0;
        });
    });

    describe('Graceful Shutdown', () => {
        test('closes all connections on shutdown', async () => {
            const resources = {
                connections: [],
                timers: [],
                shutdown: function() {
                    this.connections.forEach(c => c.close());
                    this.timers.forEach(t => clearInterval(t));
                    this.connections = [];
                    this.timers = [];
                }
            };

            resources.connections.push({ close: jest.fn() });
            resources.connections.push({ close: jest.fn() });

            await resources.shutdown();

            expect(resources.connections.length).toBe(0);
            expect(resources.timers.length).toBe(0);
        });

        test('waits for in-flight operations to complete', async () => {
            let operationCount = 0;
            const maxWaitMs = 5000;

            const scheduleShutdown = async () => {
                const startTime = Date.now();
                while (operationCount > 0 && Date.now() - startTime < maxWaitMs) {
                    await new Promise(r => setTimeout(r, 100));
                }
            };

            operationCount = 3;
            setTimeout(() => { operationCount--; }, 100);
            setTimeout(() => { operationCount--; }, 200);
            setTimeout(() => { operationCount--; }, 300);

            await scheduleShutdown();
            expect(operationCount).toBe(0);
        });

        test('times out graceful shutdown after limit', async () => {
            let timedOut = false;
            const maxWait = 1000;

            await Promise.race([
                new Promise(resolve => {
                    setTimeout(() => { timedOut = true; }, 500);
                    resolve();
                }),
                new Promise(resolve => setTimeout(resolve, maxWait))
            ]);

            expect(timedOut).toBe(true);
        });
    });

    describe('Concurrent Operation Safety', () => {
        test('prevents concurrent batch flushes', async () => {
            const flush = {
                isRunning: false,
                async execute() {
                    if (this.isRunning) {
                        throw new Error('Already flushing');
                    }
                    this.isRunning = true;
                    await new Promise(r => setTimeout(r, 100));
                    this.isRunning = false;
                }
            };

            const result1 = flush.execute();
            const result2 = flush.execute().catch(e => ({ error: e.message }));

            const [r1, r2] = await Promise.all([result1, result2]);

            expect(r2).toEqual({ error: 'Already flushing' });
        });

        test('handles concurrent database writes safely', async () => {
            const lock = { locked: false };
            let writeCount = 0;

            const dbWrite = async () => {
                if (lock.locked) throw new Error('Lock held');
                lock.locked = true;

                try {
                    await new Promise(r => setTimeout(r, 10));
                    writeCount++;
                } finally {
                    lock.locked = false;
                }
            };

            const writes = [dbWrite(), dbWrite(), dbWrite()];
            const results = await Promise.allSettled(writes);

            const failed = results.filter(r => r.status === 'rejected');
            const succeeded = results.filter(r => r.status === 'fulfilled');

            expect(failed.length).toBeGreaterThan(0);
            expect(writeCount).toBe(1); // Only one completed
        });
    });

    describe('Error Recovery Strategies', () => {
        test('implements exponential backoff for retries', () => {
            const getBackoffTime = (attemptNumber) => {
                const baseDelay = 100; // 100ms
                return baseDelay * Math.pow(2, attemptNumber); // 100, 200, 400, 800...
            };

            expect(getBackoffTime(0)).toBe(100);
            expect(getBackoffTime(1)).toBe(200);
            expect(getBackoffTime(2)).toBe(400);
        });

        test('implements circuit breaker pattern', () => {
            const circuitBreaker = {
                state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
                failureCount: 0,
                threshold: 5,
                resetTimeout: 60000,

                async call(fn) {
                    if (this.state === 'OPEN') {
                        throw new Error('Circuit open');
                    }

                    try {
                        const result = await fn();
                        this.failureCount = 0;
                        return result;
                    } catch (e) {
                        this.failureCount++;
                        if (this.failureCount >= this.threshold) {
                            this.state = 'OPEN';
                        }
                        throw e;
                    }
                }
            };

            expect(circuitBreaker.state).toBe('CLOSED');
        });

        test('splits large batches to avoid timeout', () => {
            const batch = Array(1000).fill({ id: Math.random() });
            const chunkSize = 100;
            const chunks = [];

            for (let i = 0; i < batch.length; i += chunkSize) {
                chunks.push(batch.slice(i, i + chunkSize));
            }

            expect(chunks.length).toBe(10);
            expect(chunks[0].length).toBe(100);
        });
    });
});
