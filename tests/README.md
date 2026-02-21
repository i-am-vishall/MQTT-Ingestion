# MQTT-Ingestion Test Suite

Comprehensive test coverage for the MQTT Ingestion project with 51+ test cases across unit, integration, and resilience testing.

## Test Organization

```
tests/
├── setup.js                   # Jest configuration and global utilities
├── unit/
│   ├── normalization.test.js  # Event normalization logic (15 tests)
│   ├── batching.test.js       # Batch processing and queue (22 tests)
│   └── authentication.test.js # Password hashing & auth (20 tests)
├── integration/
│   ├── mqtt-to-db.test.js     # MQTT ingestion to DB workflow (25 tests)
│   └── api.test.js            # REST API endpoints (28 tests)
└── negative/
    └── resilience.test.js     # Error handling & resilience (35 tests)
```

## Test Coverage

### Unit Tests (57 tests)

#### Normalization Module (15 tests)
- Event source detection (VMS, APP, DEFAULT)
- Violation extraction and formatting
- Event type classification (ANPR, CROWD, TRAFFIC, FRS)
- Timestamp normalization
- Camera ID extraction from various field names
- Payload integrity during normalization
- Edge cases: large payloads, special characters, unicode, deep nesting
- Null/undefined payload handling
- Duplicate violation_types key fix validation

#### Batch Processing (22 tests)
- Queue initialization with custom concurrency
- Sequential execution (maxConcurrent=1)
- Parallel execution (maxConcurrent>1)
- Message buffering and batch size handling
- Buffer overflow prevention
- Error handling in queue operations
- Memory management for completed tasks
- Timeout-based flush behavior
- Race condition prevention
- Database write transactional integrity

#### Authentication (20 tests)
- Password hashing with PBKDF2 (100k iterations)
- Random salt generation
- Constant-time password verification (timing attack resistant)
- Password strength validation (12+ chars, upper, lower, number, special)
- Rate limiting (5 attempts per 15 minutes per IP)
- Window expiration and reset
- Per-IP independent tracking
- Username and password validation flow
- Brute force attack prevention
- Authentication audit logging

### Integration Tests (53 tests)

#### MQTT to Database Workflow (25 tests)
- ANPR event ingestion and storage
- Raw event insertion in mqtt_events table
- Live camera state classification and updates
- ANPR fact storage with violation extraction
- Crowd event processing with state changes
- Traffic event ingestion with metrics
- FRS event processing with demographics
- Batch processing with transaction management
- Timeout-based flush behavior
- Transaction rollback on error
- Malformed message handling
- Event data validation
- Performance metrics (events/sec, buffer size)

#### REST API Endpoints (28 tests)
- GET /api/config (authenticated)
- POST /api/config (configuration updates)
- GET /api/services (service status)
- POST /api/admin/change-password (password changes)
- GET /health (ingestion health)
- GET /health/brokers (all brokers status)
- GET /health/brokers/:id (individual broker status)
- Authentication requirements (401, 403, 429 responses)
- Error handling and recovery
- Response format validation (JSON, timestamps, request IDs)
- Rate limiting responses
- Database error handling

### Negative & Resilience Tests (35 tests)

#### MQTT Connection Resilience
- Reconnection after disconnect
- Network timeout handling
- Infinite loop prevention
- Connection state change logging

#### Database Failure Handling
- Connection pool exhaustion
- Operation retry logic
- Transaction rollback
- Deadlock detection
- Connection leak prevention

#### Message Processing
- Corrupted message handling
- Required field validation
- Missing optional fields
- Invalid event quarantine

#### Resource Management
- Unclosed connection detection
- Timer interval cleanup
- Buffer overflow prevention
- Memory leak detection

#### Graceful Shutdown
- Resource cleanup
- In-flight operation completion
- Timeout enforcement

#### Concurrent Operation Safety
- Concurrent batch flush prevention
- Database write locking
- Race condition prevention

#### Error Recovery Strategies
- Exponential backoff implementation
- Circuit breaker pattern
- Batch chunking for timeout prevention

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suite
```bash
npm test -- tests/unit/normalization.test.js
npm test -- tests/integration/mqtt-to-db.test.js
npm test -- tests/negative/resilience.test.js
```

### With Coverage Report
```bash
npm test -- --coverage
```

### Watch Mode (During Development)
```bash
npm test -- --watch
```

### Verbose Output
```bash
npm test -- --verbose
```

## Test Configuration

**Jest Configuration** (`jest.config.js`):
- Test environment: Node.js
- Test timeout: 10 seconds
- Coverage threshold: 70% branches, 75% functions, 80% lines
- Module name mapping for imports

**Setup File** (`tests/setup.js`):
- Global test utilities
- Mock Logger instance
- Test event generator
- Mock cleanup between tests

## Coverage Requirements

- **Branches:** 70% minimum
- **Functions:** 75% minimum
- **Lines:** 80% minimum
- **Statements:** 80% minimum

## Test Categories

### Positive Path Tests
- Valid inputs and expected outputs
- Standard workflows and happy paths
- Normal operational scenarios

### Negative Tests
- Invalid inputs
- Missing required fields
- Error conditions
- Edge cases

### Resilience Tests
- Connection failures and recovery
- Database failures and retry logic
- Memory leaks and cleanup
- Graceful shutdown
- Concurrent operation safety

### Performance Tests
- Events per second metrics
- Batch flush duration
- Memory usage tracking

## Mocking Strategy

- **Database Pool:** Mocked with Promise-based interface
- **MQTT Client:** Event-based mock with subscription support
- **File System:** Mocked for config file operations
- **Logger:** Minimally mocked to reduce noise
- **Timers:** Jest fake timers for deterministic testing

## Environment Variables for Testing

```bash
NODE_ENV=test
DEBUG_MODE_INGESTION=true
ADMIN_USER=testadmin
ADMIN_PASS_HASH=<hashed_password>
```

## Key Testing Patterns

### Queue/Concurrency Testing
Uses BatchQueue class to verify sequential execution prevents race conditions

### Transaction Testing
BEGIN/COMMIT/ROLLBACK patterns with error injection

### Rate Limiting Testing
IP-based counter with window expiration

### Auth Testing
Username + password + rate limit validation with audit logging

### Health Check Testing
Broker state tracking with connection metrics

## Continuous Integration

Tests are run automatically on:
- Every push to main branch
- Pull requests (before merge)
- Scheduled nightly runs for performance testing

Expected test results: **All tests pass** with **80%+ coverage**

## Troubleshooting

### Flaky Tests
- Tests using real timers may be flaky; use `jest.useFakeTimers()`
- Clear mocks between tests with `jest.clearAllMocks()`

### Memory Issues
- Large test data sets use `beforeEach()` instead of `beforeAll()`
- Clear buffers and connections between test runs

### Timeout Issues
- Increase timeout for slow operations: `jest.setTimeout(15000)`
- Use `.only` to isolate and debug specific tests

## Future Enhancements

- [ ] Add E2E tests with real Docker containers
- [ ] Add performance benchmarking
- [ ] Add visual regression tests for web UI
- [ ] Add load testing with k6
- [ ] Add mutation testing for test quality
- [ ] Add contract testing with PACT

## Related Documentation

- [Architecture Overview](../docs/ARCHITECTURE.md)
- [Development Guide](../docs/DEVELOPMENT.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
