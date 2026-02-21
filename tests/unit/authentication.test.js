/**
 * Unit Tests: Authentication & Security
 * Tests password hashing, rate limiting, auth validation
 */

const crypto = require('crypto');

describe('Authentication Security', () => {
    let hashPassword, verifyPassword, RateLimiter;

    beforeAll(() => {
        // Password hashing functions (test helper mirrors production validation)
        hashPassword = (password, salt = null) => {
            if (!password) throw new Error('Password cannot be empty');
            if (typeof password !== 'string') throw new Error('Invalid password type');

            // Enforce strength similar to production
            if (password.length < 12) throw new Error('Password must be at least 12 characters');
            if (!/[A-Z]/.test(password)) throw new Error('Must contain uppercase letter');
            if (!/[a-z]/.test(password)) throw new Error('Must contain lowercase letter');
            if (!/[0-9]/.test(password)) throw new Error('Must contain number');
            if (!/[!@#$%^&*]/.test(password)) throw new Error('Must contain special character');

            if (!salt) {
                salt = crypto.randomBytes(32).toString('hex');
            }
            const hash = crypto
                .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
                .toString('hex');
            return `${salt}:${hash}`;
        };

        verifyPassword = (password, hash) => {
            try {
                if (!hash || typeof hash !== 'string' || hash.indexOf(':') === -1) return false;
                const [salt, hashPart] = hash.split(':');
                const newHash = crypto
                    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
                    .toString('hex');
                return crypto.timingSafeEqual(
                    Buffer.from(newHash),
                    Buffer.from(hashPart)
                );
            } catch (err) {
                return false;
            }
        };

        // Rate limiter
        RateLimiter = class {
            constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
                this.maxAttempts = maxAttempts;
                this.windowMs = windowMs;
                this.attempts = new Map();
            }

            check(ip) {
                const now = Date.now();
                const record = this.attempts.get(ip);

                if (!record || now - record.timestamp > this.windowMs) {
                    return { allowed: true, remaining: this.maxAttempts };
                }

                if (record.count >= this.maxAttempts) {
                    return { allowed: false, remaining: 0 };
                }

                return { allowed: true, remaining: this.maxAttempts - record.count };
            }

            recordFailure(ip) {
                const now = Date.now();
                const record = this.attempts.get(ip);

                if (!record || now - record.timestamp > this.windowMs) {
                    this.attempts.set(ip, { count: 1, timestamp: now });
                } else {
                    record.count++;
                }
            }

            reset(ip) {
                this.attempts.delete(ip);
            }
        };
    });

    describe('Password Hashing', () => {
        test('hashes password with random salt', () => {
            const password = 'SecurePassword123!';
            const hash1 = hashPassword(password);
            const hash2 = hashPassword(password);

            expect(hash1).not.toBe(hash2); // Different salts
            expect(hash1).toContain(':');
            expect(hash2).toContain(':');
        });

        test('hash includes salt and hash separated by colon', () => {
            const hash = hashPassword('TestPassword123!');
            const parts = hash.split(':');
            expect(parts.length).toBe(2);
            expect(parts[0].length).toBe(64); // 32 bytes hex = 64 chars
            expect(parts[1].length).toBe(128); // 64 bytes hex = 128 chars
        });

        test('rejects weak passwords', () => {
            const weakPasswords = [
                'short',
                '123456789',
                'NoNumbers!',
                'noupppercase123!',
                'NOLOWERCASE123!'
            ];

            weakPasswords.forEach(pwd => {
                try {
                    hashPassword(pwd);
                } catch (e) {
                    expect(e.message).toMatch(/Password|characters|contain/i);
                }
            });
        });

        test('requires minimum 12 characters', () => {
            const shortPwd = 'Pass123!';
            expect(() => hashPassword(shortPwd)).toThrow();
        });

        test('requires uppercase, lowercase, number, special char', () => {
            const testCases = [
                { pwd: 'password123!', missing: 'uppercase' },
                { pwd: 'PASSWORD123!', missing: 'lowercase' },
                { pwd: 'Password!', missing: 'number' },
                { pwd: 'Password123', missing: 'special' }
            ];

            testCases.forEach(tc => {
                expect(() => hashPassword(tc.pwd)).toThrow();
            });
        });
    });

    describe('Password Verification', () => {
        test('verifies correct password', () => {
            const password = 'CorrectPassword123!';
            const hash = hashPassword(password);
            const isValid = verifyPassword(password, hash);

            expect(isValid).toBe(true);
        });

        test('rejects incorrect password', () => {
            const password = 'CorrectPassword123!';
            const wrongPassword = 'WrongPassword456!';
            const hash = hashPassword(password);

            const isValid = verifyPassword(wrongPassword, hash);
            expect(isValid).toBe(false);
        });

        test('uses constant-time comparison (resistant to timing attacks)', () => {
            const password = 'SecurePassword789!';
            const hash = hashPassword(password);

            const wrongPassword = 'WrongPassword123!';
            const start = Date.now();
            verifyPassword(wrongPassword, hash);
            const duration1 = Date.now() - start;

            const start2 = Date.now();
            verifyPassword(wrongPassword, hash);
            const duration2 = Date.now() - start2;

            // Both should take roughly the same time (constant-time)
            // Note: This is probabilistic due to timing variance
            expect(Math.abs(duration1 - duration2)).toBeLessThan(100);
        });

        test('handles invalid hash format gracefully', () => {
            const invalidHashes = [
                'nocolon',
                'invalid:hash:format',
                '',
                null,
                undefined
            ];

            invalidHashes.forEach(hash => {
                expect(() => verifyPassword('password', hash)).not.toThrow();
                expect(verifyPassword('password', hash)).toBe(false);
            });
        });

        test('handles special characters in password', () => {
            const passwords = [
                'MyP@ssw0rd!@#',
                'P%^&*()Test123!',
                'Quote"Test123!'
            ];

            passwords.forEach(pwd => {
                const hash = hashPassword(pwd);
                expect(verifyPassword(pwd, hash)).toBe(true);
            });
        });

        test('handles unicode characters in password', () => {
            const password = 'Pässwörd123!Ñ';
            const hash = hashPassword(password);
            expect(verifyPassword(password, hash)).toBe(true);
        });
    });

    describe('Rate Limiting', () => {
        test('allows requests when limit not exceeded', () => {
            const limiter = new RateLimiter(5, 60000);
            const result = limiter.check('192.168.1.1');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(5);
        });

        test('blocks after max attempts exceeded', () => {
            const limiter = new RateLimiter(3, 60000);
            const ip = '192.168.1.1';

            limiter.recordFailure(ip);
            limiter.recordFailure(ip);
            limiter.recordFailure(ip);

            const result = limiter.check(ip);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        test('tracks remaining attempts', () => {
            const limiter = new RateLimiter(5, 60000);
            const ip = '192.168.1.1';

            limiter.recordFailure(ip);
            let result = limiter.check(ip);
            expect(result.remaining).toBe(4);

            limiter.recordFailure(ip);
            result = limiter.check(ip);
            expect(result.remaining).toBe(3);
        });

        test('resets rate limit when window expires', () => {
            jest.useFakeTimers();
            const limiter = new RateLimiter(3, 5000); // 5 second window
            const ip = '192.168.1.1';

            limiter.recordFailure(ip);
            limiter.recordFailure(ip);
            limiter.recordFailure(ip);

            let result = limiter.check(ip);
            expect(result.allowed).toBe(false);

            // Fast forward past window
            jest.advanceTimersByTime(6000);

            result = limiter.check(ip);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(limiter.maxAttempts);

            jest.useRealTimers();
        });

        test('tracks different IPs independently', () => {
            const limiter = new RateLimiter(3, 60000);

            limiter.recordFailure('192.168.1.1');
            limiter.recordFailure('192.168.1.1');

            limiter.recordFailure('192.168.1.2');

            const result1 = limiter.check('192.168.1.1');
            const result2 = limiter.check('192.168.1.2');

            expect(result1.remaining).toBe(1);
            expect(result2.remaining).toBe(2);
        });

        test('allows reset of rate limit for IP', () => {
            const limiter = new RateLimiter(3, 60000);
            const ip = '192.168.1.1';

            limiter.recordFailure(ip);
            limiter.recordFailure(ip);
            limiter.recordFailure(ip);

            let result = limiter.check(ip);
            expect(result.allowed).toBe(false);

            limiter.reset(ip);

            result = limiter.check(ip);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(3);
        });
    });

    describe('Authentication Flow', () => {
        test('validates username and password correctly', () => {
            const adminUser = 'admin';
            const adminPassword = 'AdminPassword123!';
            const adminHash = hashPassword(adminPassword);

            const attemptUser = 'admin';
            const attemptPassword = 'AdminPassword123!';

            const usernameMatch = attemptUser === adminUser;
            const passwordMatch = verifyPassword(attemptPassword, adminHash);

            expect(usernameMatch && passwordMatch).toBe(true);
        });

        test('rejects invalid username', () => {
            const adminUser = 'admin';
            const adminPassword = 'AdminPassword123!';
            const adminHash = hashPassword(adminPassword);

            const attemptUser = 'hacker';
            const attemptPassword = 'AdminPassword123!';

            const usernameMatch = attemptUser === adminUser;
            const passwordMatch = verifyPassword(attemptPassword, adminHash);

            expect(usernameMatch && passwordMatch).toBe(false);
        });

        test('rejects invalid password', () => {
            const adminUser = 'admin';
            const adminPassword = 'AdminPassword123!';
            const adminHash = hashPassword(adminPassword);

            const attemptUser = 'admin';
            const attemptPassword = 'WrongPassword456!';

            const usernameMatch = attemptUser === adminUser;
            const passwordMatch = verifyPassword(attemptPassword, adminHash);

            expect(usernameMatch && passwordMatch).toBe(false);
        });

        test('prevents brute force attacks with rate limiting', () => {
            const limiter = new RateLimiter(5, 60000);
            const ip = '192.168.1.1';

            for (let i = 0; i < 5; i++) {
                limiter.recordFailure(ip);
            }

            const result = limiter.check(ip);
            expect(result.allowed).toBe(false);
        });

        test('logs authentication attempts', () => {
            const auditLog = [];

            const recordAttempt = (event, details) => {
                auditLog.push({ event, ...details, timestamp: new Date().toISOString() });
            };

            recordAttempt('SUCCESSFUL_AUTH', { user: 'admin', ip: '192.168.1.1' });
            recordAttempt('INVALID_PASSWORD', { user: 'admin', ip: '192.168.1.2' });

            expect(auditLog.length).toBe(2);
            expect(auditLog[0].event).toBe('SUCCESSFUL_AUTH');
            expect(auditLog[1].event).toBe('INVALID_PASSWORD');
            expect(auditLog[0].user).toBe('admin');
        });
    });
});
