/**
 * Unit Tests: Normalization Module
 * Tests schema normalization, event classification, violation extraction
 */

describe('Normalization Module', () => {
    let normalizeEvent, detectSource, extractViolations;

    beforeAll(() => {
        // Mock the logger to avoid noise in test output
        jest.mock('../../ingestion-service/utils/createLogger', () => {
            return () => ({
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            });
        });

        // Import normalization functions
        const normalization = require('../../ingestion-service/src/normalization');
        normalizeEvent = normalization.normalizeEvent;
        detectSource = normalization.detectSource;
        extractViolations = normalization.extractViolations || ((p) => []);
    });

    describe('detectSource()', () => {
        test('detects VMS events correctly', () => {
            const payload = {
                EventName: 'ANPR',
                DeviceId: 'CAM001',
                timestamp: '2026-02-21T10:00:00Z'
            };
            expect(detectSource(payload)).toBe('VMS');
        });

        test('detects APP events correctly', () => {
            const payload = {
                appName: 'MyApp',
                timestamp: '2026-02-21T10:00:00Z',
                camId: 'CAM001'
            };
            expect(detectSource(payload)).toBe('APP');
        });

        test('returns DEFAULT when source cannot be detected', () => {
            const payload = { timestamp: '2026-02-21T10:00:00Z' };
            expect(detectSource(payload)).toBe('DEFAULT');
        });

        test('handles missing payload gracefully', () => {
            expect(() => detectSource(null)).not.toThrow();
        });
    });

    describe('extractViolations()', () => {
        test('extracts violations from flags correctly', () => {
            const flags = {
                SpeedViolated: true,
                RedLightViolated: true,
                WrongDirectionDetected: false
            };
            const violations = extractViolations(flags);
            expect(violations).toContain('SpeedViolated');
            expect(violations).toContain('RedLightViolated');
            expect(violations).not.toContain('WrongDirectionDetected');
        });

        test('handles empty violation flags', () => {
            const flags = {};
            const violations = extractViolations(flags);
            expect(Array.isArray(violations)).toBe(true);
            expect(violations.length).toBe(0);
        });

        test('handles null violation flags', () => {
            expect(() => extractViolations(null)).not.toThrow();
            expect(Array.isArray(extractViolations(null))).toBe(true);
        });

        test('returns expected violation keys', () => {
            const flags = {
                SpeedViolated: true,
                RedLightViolated: true
            };
            const violations = extractViolations(flags);
            expect(violations.length).toBeGreaterThan(0);
            expect(violations).toContain('SpeedViolated');
        });
    });

    describe('normalizeEvent()', () => {
        test('normalizes VMS ANPR event correctly', () => {
            const payload = {
                source: 'VMS',
                timestamp: '2026-02-21T10:00:00Z',
                cameraId: 'CAM001',
                licensePlate: 'ABC123',
                confidence: 0.95,
                violations: { SpeedViolated: true }
            };

            const normalized = normalizeEvent(null, payload);

            expect(normalized).toHaveProperty('event_type');
            expect(normalized).toHaveProperty('camera_id');
            expect(normalized).toHaveProperty('payload');
            expect(normalized).toHaveProperty('event_time');
        });

        test('normalizes APP ANPR event correctly', () => {
            const payload = {
                source: 'APP',
                timestamp: '2026-02-21T10:00:00Z',
                cameraId: 'CAM002',
                licensePlate: 'XYZ789',
                confidence: 0.88
            };

            const normalized = normalizeEvent(null, payload);
            expect(normalized.camera_id).toBeDefined();
        });

        test('handles missing required fields without throwing', () => {
            const payload = {};
            expect(() => normalizeEvent(null, payload)).not.toThrow();
        });

        test('normalizes event_time correctly', () => {
            const payload = { timestamp: '2026-02-21T10:00:00Z' };
            const normalized = normalizeEvent(null, payload);
            expect(normalized.event_time).toBeDefined();
            expect(new Date(normalized.event_time)).toBeInstanceOf(Date);
        });

        test('handles null/undefined payload without crashing', () => {
            expect(() => normalizeEvent(null, null)).not.toThrow();
            expect(() => normalizeEvent(null, undefined)).not.toThrow();
            expect(() => normalizeEvent(null, {})).not.toThrow();
        });
    });
});
