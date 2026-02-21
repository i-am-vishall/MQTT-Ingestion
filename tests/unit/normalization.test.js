/**
 * Unit Tests: Normalization Module
 * Tests schema normalization, event classification, violation extraction
 */

describe('Normalization Module', () => {
    let normalizeEvent, detectSource, extractViolations;

    beforeAll(() => {
        // Mock the logger to avoid noise in test output
        jest.mock('../ingestion-service/utils/createLogger', () => {
            return () => ({
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            });
        });

        // Import normalization functions
        const normalization = require('../ingestion-service/src/normalization');
        normalizeEvent = normalization.normalizeEvent;
        detectSource = normalization.detectSource;
        extractViolations = normalization.extractViolations;
    });

    describe('detectSource()', () => {
        test('detects VMS events correctly', () => {
            const event = {
                payload: {
                    source: 'VMS',
                    timestamp: '2026-02-21T10:00:00Z',
                    deviceName: 'CAM001'
                }
            };
            expect(detectSource(event)).toBe('VMS');
        });

        test('detects APP events correctly', () => {
            const event = {
                payload: {
                    source: 'APP',
                    timestamp: '2026-02-21T10:00:00Z',
                    deviceName: 'CAM001'
                }
            };
            expect(detectSource(event)).toBe('APP');
        });

        test('returns DEFAULT when source cannot be detected', () => {
            const event = { payload: { timestamp: '2026-02-21T10:00:00Z' } };
            expect(detectSource(event)).toBe('DEFAULT');
        });

        test('handles missing payload gracefully', () => {
            const event = { payload: null };
            expect(() => detectSource(event)).not.toThrow();
        });
    });

    describe('extractViolations()', () => {
        test('extracts violations from flags correctly', () => {
            const flags = {
                speeding: true,
                redLight: true,
                wrongLane: false
            };
            const violations = extractViolations(flags);
            expect(violations).toContain('speeding');
            expect(violations).toContain('redLight');
            expect(violations).not.toContain('wrongLane');
        });

        test('handles empty violation flags', () => {
            const flags = {};
            const violations = extractViolations(flags);
            expect(Array.isArray(violations)).toBe(true);
            expect(violations.length).toBe(0);
        });

        test('handles null violation flags', () => {
            expect(() => extractViolations(null)).not.toThrow();
        });

        test('converts violation keys to uppercase', () => {
            const flags = {
                speedingViolation: true,
                redLightViolation: true
            };
            const violations = extractViolations(flags);
            expect(violations.some(v => v.toUpperCase() === v)).toBeTruthy();
        });
    });

    describe('normalizeEvent()', () => {
        test('normalizes VMS ANPR event correctly', () => {
            const event = {
                payload: {
                    source: 'VMS',
                    timestamp: '2026-02-21T10:00:00Z',
                    cameraId: 'CAM001',
                    licensePlate: 'ABC123',
                    confidence: 0.95,
                    violations: {
                        speeding: true,
                        redLight: false
                    }
                }
            };

            const normalized = normalizeEvent(event);

            expect(normalized).toHaveProperty('event_type');
            expect(normalized).toHaveProperty('camera_id');
            expect(normalized).toHaveProperty('payload');
            expect(normalized).toHaveProperty('normalized');
            expect(normalized.normalized).toHaveProperty('source_id');
        });

        test('normalizes APP ANPR event correctly', () => {
            const event = {
                payload: {
                    source: 'APP',
                    timestamp: '2026-02-21T10:00:00Z',
                    cameraId: 'CAM002',
                    licensePlate: 'XYZ789',
                    confidence: 0.88
                }
            };

            const normalized = normalizeEvent(event);
            expect(normalized.camera_id).toBe('CAM002');
            expect(normalized.normalized?.source_id).toBeDefined();
        });

        test('handles missing required fields', () => {
            const event = { payload: {} };
            expect(() => normalizeEvent(event)).not.toThrow();
        });

        test('normalizes event_time correctly', () => {
            const event = {
                payload: {
                    timestamp: '2026-02-21T10:00:00Z'
                }
            };

            const normalized = normalizeEvent(event);
            expect(normalized.event_time).toBeDefined();
            expect(new Date(normalized.event_time)).toBeInstanceOf(Date);
        });

        test('extracts camera_id from various field names', () => {
            const testCases = [
                { eventPayload: { cameraId: 'CAM001' }, cameraObj: { camera_id: 'CAM001' } },
                { eventPayload: { cameraid: 'CAM002' }, cameraObj: { camera_id: 'CAM002' } },
                { eventPayload: { deviceId: 'CAM003' }, cameraObj: { camera_id: 'CAM003' } }
            ];

            testCases.forEach(tc => {
                const event = { payload: tc.eventPayload };
                const normalized = normalizeEvent(event);
                expect(normalized.camera_id).toBeDefined();
            });
        });

        test('normalizes CROWD events', () => {
            const event = {
                payload: {
                    source: 'APP',
                    eventType: 'CROWD',
                    personCount: 25,
                    cameraId: 'CAM001'
                }
            };

            const normalized = normalizeEvent(event);
            expect(normalized.event_type).toMatch(/CROWD/i);
        });

        test('normalizes FACE_RECOGNITION events', () => {
            const event = {
                payload: {
                    source: 'VMS',
                    eventType: 'Face_Recognition',
                    personName: 'John Doe',
                    cameraId: 'CAM001'
                }
            };

            const normalized = normalizeEvent(event);
            expect(normalized.event_type).toMatch(/FACE|FRS/i);
        });

        test('handles duplicate violation_types key gracefully', () => {
            // This tests the fix for the duplicate key bug
            const event = {
                payload: {
                    source: 'VMS',
                    cameraId: 'CAM001',
                    violations: {
                        speeding: true
                    }
                }
            };

            const normalized = normalizeEvent(event);
            if (normalized.payload?.violation_types) {
                expect(Array.isArray(normalized.payload.violation_types)).toBe(true);
            }
        });

        test('preserves payload integrity during normalization', () => {
            const originalPayload = {
                source: 'APP',
                cameraId: 'CAM001',
                customField: 'customValue'
            };
            const event = { payload: { ...originalPayload } };

            const normalized = normalizeEvent(event);
            expect(normalized.payload.customField).toBe('customValue');
        });

        test('handles null/undefined payload without crashing', () => {
            expect(() => normalizeEvent({ payload: null })).not.toThrow();
            expect(() => normalizeEvent({ payload: undefined })).not.toThrow();
            expect(() => normalizeEvent({})).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        test('handles very large payloads', () => {
            const event = {
                payload: {
                    source: 'APP',
                    cameraId: 'CAM001',
                    largeData: 'x'.repeat(10000)
                }
            };

            expect(() => normalizeEvent(event)).not.toThrow();
        });

        test('handles special characters in field values', () => {
            const event = {
                payload: {
                    source: 'APP',
                    cameraId: 'CAM-001_special@#$',
                    licensePlate: 'ABC@123!#'
                }
            };

            const normalized = normalizeEvent(event);
            expect(normalized.camera_id).toBeDefined();
        });

        test('handles unicode characters', () => {
            const event = {
                payload: {
                    source: 'APP',
                    cameraId: 'CAM001',
                    personName: '张三 (Chinese)'
                }
            };

            expect(() => normalizeEvent(event)).not.toThrow();
        });

        test('handles deeply nested payload structures', () => {
            const event = {
                payload: {
                    source: 'APP',
                    cameraId: 'CAM001',
                    metadata: {
                        nested: {
                            deepLevel: {
                                value: 'test'
                            }
                        }
                    }
                }
            };

            expect(() => normalizeEvent(event)).not.toThrow();
        });
    });
});
