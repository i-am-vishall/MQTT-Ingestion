/**
 * Jest Setup File
 * Runs once before all test suites
 */

// Suppress console output during tests (optional)
// global.console = {
//     log: jest.fn(),
//     error: jest.fn(),
//     warn: jest.fn(),
//     info: jest.fn(),
// };

// Mock timers globally if needed
// Note: Global fake timers interfere with tests relying on real timeouts.
// Tests that require fake timers should enable them locally.
// jest.useFakeTimers();

// Global test utilities
global.testUtils = {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    generateMockEvent: (overrides = {}) => ({
        event_time: new Date().toISOString(),
        camera_id: 'CAM001',
        event_type: 'ANPR',
        severity: 'INFO',
        payload: { license_plate: 'ABC123' },
        normalized: {
            camera_name: 'Main Gate',
            source_id: 'MQTT_BROKER_1',
            source_ip: '192.168.1.100'
        },
        ...overrides
    })
};

afterEach(() => {
    jest.clearAllMocks();
});
