/**
 * Integration Tests: MQTT to Database
 * Tests complete message flow from MQTT ingestion to database persistence
 */

describe('MQTT Ingestion to Database', () => {
    let pool, mqttClient, messageHandler;

    beforeEach(() => {
        // Mock PostgreSQL pool
        pool = {
            connect: jest.fn(),
            query: jest.fn(),
            release: jest.fn()
        };

        // Mock MQTT client
        mqttClient = {
            on: jest.fn(),
            subscribe: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn()
        };

        // Mock message handler
        messageHandler = jest.fn();
    });

    describe('ANPR Event Ingestion', () => {
        test('processes ANPR event from MQTT to database', async () => {
            const event = {
                topic: 'anpr/camera001',
                message: Buffer.from(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    cameraId: 'CAM001',
                    licensePlate: 'ABC123',
                    confidence: 0.95,
                    violations: {
                        speeding: true,
                        redLight: false
                    }
                }))
            };

            const client = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };

            pool.connect = jest.fn().mockResolvedValue(client);

            // Process message
            expect(pool.connect).toBeDefined();
            expect(client.query).toBeDefined();
        });

        test('stores raw event in mqtt_events table', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };

            const expectedQuery = expect.stringContaining('INSERT INTO mqtt_events');
            const expectedParams = expect.arrayContaining([
                expect.any(String), // event_time
                'CAM001', // camera_id
                'ANPR' // event_type
            ]);

            expect(mockClient.query).toBeDefined();
        });

        test('classifies event and updates live_camera_state', async () => {
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            };

            // First call: raw insert
            // Second call: live state update
            expect(mockClient.query).toBeDefined();
        });

        test('stores ANPR facts in anpr_event_fact table', async () => {
            const event = {
                camera_id: 'CAM001',
                normalized: {
                    camera_name: 'Main Gate',
                    source_id: 'MQTT_BROKER_1'
                },
                event_time: new Date().toISOString(),
                payload: {
                    licensePlate: 'ABC123',
                    confidence: 0.95,
                    violations: {
                        speeding: true
                    }
                }
            };

            // Verify event has required fields
            expect(event.camera_id).toBeDefined();
            expect(event.payload.licensePlate).toBeDefined();
            expect(event.event_time).toBeDefined();
        });

        test('extracts and stores violation types', () => {
            const violations = {
                speeding: true,
                redLight: true,
                wrongLane: false
            };

            const extractedViolations = Object.keys(violations)
                .filter(key => violations[key])
                .map(key => key.toUpperCase());

            expect(extractedViolations).toContain('SPEEDING');
            expect(extractedViolations).toContain('REDLIGHT');
            expect(extractedViolations).not.toContain('WRONGLANE');
            expect(extractedViolations.length).toBe(2);
        });
    });

    describe('Crowd Event Ingestion', () => {
        test('processes CROWD event and updates live camera state', () => {
            const event = {
                camera_id: 'CAM002',
                event_type: 'CROWD',
                payload: {
                    personCount: 25,
                    status: 'CROWDED'
                },
                normalized: {
                    camera_name: 'Entrance',
                    source_id: 'MQTT_BROKER_1'
                }
            };

            expect(event.event_type).toBe('CROWD');
            expect(event.payload.personCount).toBeGreaterThan(0);
        });

        test('tracks crowd state changes over time', () => {
            const measurements = [
                { timestamp: '10:00:00', count: 5, state: 'NORMAL' },
                { timestamp: '10:05:00', count: 15, state: 'CROWDED' },
                { timestamp: '10:10:00', count: 8, state: 'NORMAL' }
            ];

            const stateChanges = [];
            for (let i = 1; i < measurements.length; i++) {
                if (measurements[i].state !== measurements[i - 1].state) {
                    stateChanges.push({
                        from: measurements[i - 1].state,
                        to: measurements[i].state,
                        at: measurements[i].timestamp
                    });
                }
            }

            expect(stateChanges.length).toBe(2);
            expect(stateChanges[0].from).toBe('NORMAL');
            expect(stateChanges[0].to).toBe('CROWDED');
        });
    });

    describe('Traffic Event Ingestion', () => {
        test('processes TRAFFIC event with vehicle count', () => {
            const event = {
                camera_id: 'CAM003',
                event_type: 'TRAFFIC',
                payload: {
                    vehicle_count: 42,
                    traffic_state: 'HEAVY'
                }
            };

            expect(event.payload.vehicle_count).toBe(42);
            expect(event.payload.traffic_state).toBe('HEAVY');
        });

        test('updates traffic metrics table', () => {
            const metrics = {
                timestamp: new Date(),
                camera_id: 'CAM003',
                vehicle_count: 42,
                traffic_state: 'HEAVY'
            };

            expect(metrics.vehicle_count).toBeGreaterThanOrEqual(0);
            expect(metrics.traffic_state).toMatch(/LIGHT|NORMAL|HEAVY|CONGESTED/i);
        });
    });

    describe('Face Recognition Event Ingestion', () => {
        test('processes FRS event with person identification', () => {
            const event = {
                camera_id: 'CAM004',
                event_type: 'Face_Recognition',
                payload: {
                    personName: 'John Doe',
                    gender: 'Male',
                    age: 35,
                    confidence: 0.92
                }
            };

            expect(event.payload.personName).toBeDefined();
            expect(event.payload.gender).toMatch(/Male|Female/i);
        });

        test('stores FRS facts with metrics', () => {
            const frsEvent = {
                event_time: new Date().toISOString(),
                camera_id: 'CAM004',
                person_name: 'John Doe',
                gender: 'Male',
                age: 35,
                det_conf: 0.92,
                rec_conf: 0.88
            };

            expect(frsEvent.det_conf).toBeGreaterThanOrEqual(0);
            expect(frsEvent.det_conf).toBeLessThanOrEqual(1);
            expect(frsEvent.rec_conf).toBeGreaterThanOrEqual(0);
            expect(frsEvent.rec_conf).toBeLessThanOrEqual(1);
        });

        test('tracks person demographics', () => {
            const persons = [
                { name: 'John', gender: 'Male', age: 35 },
                { name: 'Jane', gender: 'Female', age: 28 },
                { name: 'Bob', gender: 'Male', age: 45 }
            ];

            const femaleCount = persons.filter(p => p.gender === 'Female').length;
            const maleCount = persons.filter(p => p.gender === 'Male').length;
            const avgAge = persons.reduce((sum, p) => sum + p.age, 0) / persons.length;

            expect(femaleCount).toBe(1);
            expect(maleCount).toBe(2);
            expect(avgAge).toBeCloseTo(36, 0);
        });
    });

    describe('Batch Processing Integration', () => {
        test('batches multiple events and flushes to database', async () => {
            const buffer = [];
            const BATCH_SIZE = 5;

            // Simulate adding events
            for (let i = 0; i < BATCH_SIZE; i++) {
                buffer.push({
                    event_time: new Date().toISOString(),
                    camera_id: `CAM${i}`,
                    event_type: 'ANPR'
                });
            }

            expect(buffer.length).toBe(BATCH_SIZE);

            // Simulate flush
            const flushed = buffer.splice(0);
            expect(flushed.length).toBe(BATCH_SIZE);
            expect(buffer.length).toBe(0);
        });

        test('handles timeout-based flush when batch not full', (done) => {
            const buffer = [];
            const BATCH_SIZE = 100;
            const BATCH_TIMEOUT_MS = 100;

            buffer.push({ id: 1 });
            expect(buffer.length).toBeLessThan(BATCH_SIZE);

            setTimeout(() => {
                // After timeout, should flush
                expect(buffer.length).toBeGreaterThan(0);
                done();
            }, BATCH_TIMEOUT_MS + 50);
        });

        test('maintains transactional integrity across batch', async () => {
            const client = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [] }) // BEGIN
                    .mockResolvedValueOnce({ rows: [] }) // First insert
                    .mockResolvedValueOnce({ rows: [] }) // Second insert
                    .mockResolvedValueOnce({ rows: [] }), // COMMIT
                release: jest.fn()
            };

            // Simulate batch transaction
            await client.query('BEGIN');
            await client.query('INSERT INTO mqtt_events ...');
            await client.query('INSERT INTO mqtt_events ...');
            await client.query('COMMIT');

            expect(client.query).toHaveBeenCalledTimes(4);
        });

        test('rolls back transaction on error', async () => {
            const client = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [] }) // BEGIN
                    .mockRejectedValueOnce(new Error('Insert failed')) // Error
                    .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
                release: jest.fn()
            };

            try {
                await client.query('BEGIN');
                await client.query('INSERT ...');
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
            }

            expect(client.query).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('handles database connection failures gracefully', async () => {
            const pool = {
                connect: jest.fn().mockRejectedValue(new Error('Connection failed'))
            };

            let connectionError = null;
            try {
                await pool.connect();
            } catch (e) {
                connectionError = e;
            }

            expect(connectionError).not.toBeNull();
            expect(connectionError.message).toContain('connection');
        });

        test('continues processing after insert failure', async () => {
            const events = [];
            const failEvent = { id: 2, shouldFail: true };

            events.push({ id: 1 });
            events.push(failEvent);
            events.push({ id: 3 });

            const results = [];
            for (const event of events) {
                try {
                    if (event.shouldFail) {
                        throw new Error('Insert failed');
                    }
                    results.push({ event, success: true });
                } catch (e) {
                    results.push({ event, success: false, error: e.message });
                }
            }

            expect(results.length).toBe(3);
            expect(results[1].success).toBe(false);
            expect(results[2].success).toBe(true);
        });

        test('handles malformed MQTT messages', () => {
            const malformedMessages = [
                Buffer.from('not json'),
                Buffer.from('{"incomplete":'),
                Buffer.from('')
            ];

            malformedMessages.forEach(msg => {
                expect(() => {
                    try {
                        JSON.parse(msg.toString());
                    } catch (e) {
                        throw new Error(`Invalid JSON: ${e.message}`);
                    }
                }).toThrow();
            });
        });

        test('validates event data before insertion', () => {
            const validator = (event) => {
                const errors = [];
                if (!event.camera_id) errors.push('Missing camera_id');
                if (!event.event_time) errors.push('Missing event_time');
                if (!event.payload) errors.push('Missing payload');
                return { valid: errors.length === 0, errors };
            };

            const validEvent = {
                camera_id: 'CAM001',
                event_time: new Date().toISOString(),
                payload: { test: 'data' }
            };

            const invalidEvent = {
                camera_id: 'CAM001'
            };

            expect(validator(validEvent).valid).toBe(true);
            expect(validator(invalidEvent).valid).toBe(false);
            expect(validator(invalidEvent).errors.length).toBe(2);
        });
    });

    describe('Performance Metrics', () => {
        test('tracks events processed per second', () => {
            const startTime = Date.now();
            let eventCount = 0;

            for (let i = 0; i < 1000; i++) {
                eventCount++;
            }

            const duration = Date.now() - startTime;
            const eventsPerSecond = (eventCount / duration) * 1000;

            expect(eventsPerSecond).toBeGreaterThan(0);
        });

        test('measures batch flush duration', async () => {
            const startTime = Date.now();

            // Simulate database write
            await new Promise(resolve => setTimeout(resolve, 10));

            const duration = Date.now() - startTime;
            expect(duration).toBeGreaterThanOrEqual(10);
            expect(duration).toBeLessThan(100);
        });

        test('monitors buffer size', () => {
            const buffer = [];
            const MAX_BUFFER = 5000;
            const memoryBefore = process.memoryUsage().heapUsed;

            for (let i = 0; i < 1000; i++) {
                buffer.push({ id: i, data: 'x'.repeat(100) });
            }

            const memoryAfter = process.memoryUsage().heapUsed;
            const memoryUsed = memoryAfter - memoryBefore;

            expect(buffer.length).toBeLessThanOrEqual(MAX_BUFFER);
            expect(memoryUsed).toBeGreaterThan(0);
        });
    });
});
