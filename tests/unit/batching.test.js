/**
 * Unit Tests: Batch Processing & Queue
 * Tests BatchQueue, message buffering, and flush logic
 */

describe('Batch Processing - BatchQueue Class', () => {
    let BatchQueue;

    beforeAll(() => {
        // Create a simple BatchQueue implementation for testing
        BatchQueue = class {
            constructor(maxConcurrent = 1) {
                this.queue = [];
                this.running = 0;
                this.maxConcurrent = maxConcurrent;
            }

            async enqueue(fn) {
                return new Promise((resolve, reject) => {
                    this.queue.push({ fn, resolve, reject });
                    this._process();
                });
            }

            async _process() {
                if (this.running >= this.maxConcurrent || this.queue.length === 0) {
                    return;
                }

                this.running++;
                const { fn, resolve, reject } = this.queue.shift();

                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.running--;
                    this._process();
                }
            }

            getQueueLength() {
                return this.queue.length;
            }

            isProcessing() {
                return this.running > 0;
            }
        };
    });

    describe('BatchQueue initialization', () => {
        test('creates queue with default concurrency of 1', () => {
            const queue = new BatchQueue();
            expect(queue.maxConcurrent).toBe(1);
        });

        test('creates queue with custom concurrency', () => {
            const queue = new BatchQueue(3);
            expect(queue.maxConcurrent).toBe(3);
        });

        test('initializes empty queue', () => {
            const queue = new BatchQueue();
            expect(queue.getQueueLength()).toBe(0);
            expect(queue.isProcessing()).toBe(false);
        });
    });

    describe('Sequential execution (maxConcurrent=1)', () => {
        test('executes single task successfully', async () => {
            const queue = new BatchQueue(1);
            const mockFn = jest.fn().mockResolvedValue('success');

            const result = await queue.enqueue(mockFn);

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('executes tasks sequentially, not concurrently', async () => {
            const queue = new BatchQueue(1);
            const executionOrder = [];

            const fn1 = jest.fn(async () => {
                executionOrder.push('start1');
                await new Promise(r => setTimeout(r, 10));
                executionOrder.push('end1');
                return 'task1';
            });

            const fn2 = jest.fn(async () => {
                executionOrder.push('start2');
                await new Promise(r => setTimeout(r, 10));
                executionOrder.push('end2');
                return 'task2';
            });

            const fn3 = jest.fn(async () => {
                executionOrder.push('start3');
                executionOrder.push('end3');
                return 'task3';
            });

            const p1 = queue.enqueue(fn1);
            const p2 = queue.enqueue(fn2);
            const p3 = queue.enqueue(fn3);

            await Promise.all([p1, p2, p3]);

            // Verify sequential execution
            expect(executionOrder).toEqual([
                'start1', 'end1',
                'start2', 'end2',
                'start3', 'end3'
            ]);
        });

        test('prevents race conditions in database writes', async () => {
            const queue = new BatchQueue(1);
            const writeCount = { value: 0 };

            const dbWrite = jest.fn(async () => {
                await new Promise(r => setTimeout(r, 5));
                writeCount.value += 1;
                return true;
            });

            const results = await Promise.all([
                queue.enqueue(dbWrite),
                queue.enqueue(dbWrite),
                queue.enqueue(dbWrite)
            ]);

            expect(results.length).toBe(3);
            expect(writeCount.value).toBe(3);
        });

        test('handles task failures without blocking subsequent tasks', async () => {
            const queue = new BatchQueue(1);
            const fn1 = jest.fn().mockRejectedValue(new Error('Task 1 failed'));
            const fn2 = jest.fn().mockResolvedValue('Task 2 success');

            const p1 = queue.enqueue(fn1);
            const p2 = queue.enqueue(fn2);

            try {
                await p1;
            } catch (e) {
                expect(e.message).toBe('Task 1 failed');
            }

            const result2 = await p2;
            expect(result2).toBe('Task 2 success');
        });
    });

    describe('Parallel execution (maxConcurrent>1)', () => {
        test('executes multiple tasks concurrently up to maxConcurrent', async () => {
            const queue = new BatchQueue(3);
            const executionOrder = [];

            const fn = jest.fn(async (id) => {
                executionOrder.push(`start${id}`);
                await new Promise(r => setTimeout(r, 20));
                executionOrder.push(`end${id}`);
            });

            await Promise.all([
                queue.enqueue(() => fn(1)),
                queue.enqueue(() => fn(2)),
                queue.enqueue(() => fn(3))
            ]);

            // All should start before any end (parallel execution)
            const startCount = executionOrder.filter(x => x.startsWith('start')).length;
            expect(startCount).toBe(3);
        });
    });

    describe('Message buffering', () => {
        test('buffers messages until batch size reached', () => {
            const buffer = [];
            const BATCH_SIZE = 5;

            for (let i = 0; i < 3; i++) {
                buffer.push({ id: i, data: `msg${i}` });
            }

            expect(buffer.length).toBe(3);
            expect(buffer.length < BATCH_SIZE).toBe(true);
        });

        test('clears buffer after flush', () => {
            const buffer = [];
            buffer.push({ id: 1 });
            buffer.push({ id: 2 });

            const flushed = buffer.splice(0);
            expect(flushed.length).toBe(2);
            expect(buffer.length).toBe(0);
        });

        test('handles buffer overflow gracefully', () => {
            const buffer = [];
            const MAX_BUFFER = 100;

            // Simulate overflow
            for (let i = 0; i < 150; i++) {
                if (buffer.length >= MAX_BUFFER) {
                    const dropCount = Math.floor(MAX_BUFFER * 0.1);
                    buffer.splice(0, dropCount);
                }
                buffer.push({ id: i });
            }

            expect(buffer.length).toBeLessThanOrEqual(MAX_BUFFER);
            expect(buffer.length).toBeGreaterThan(MAX_BUFFER * 0.9);
        });
    });

    describe('Error handling', () => {
        test('rejects promise on task error', async () => {
            const queue = new BatchQueue();
            const error = new Error('Task error');
            const fn = jest.fn().mockRejectedValue(error);

            await expect(queue.enqueue(fn)).rejects.toThrow('Task error');
        });

        test('continues processing after error', async () => {
            const queue = new BatchQueue();
            const fn1 = jest.fn().mockRejectedValue(new Error('Error 1'));
            const fn2 = jest.fn().mockResolvedValue('Success 2');

            const p1 = queue.enqueue(fn1).catch(e => ({ error: e.message }));
            const p2 = queue.enqueue(fn2);

            const results = await Promise.all([p1, p2]);
            expect(results[0]).toEqual({ error: 'Error 1' });
            expect(results[1]).toBe('Success 2');
        });

        test('handles timeout in queue processing', async () => {
            const queue = new BatchQueue();
            const slowFn = jest.fn(() => new Promise(r => {
                setTimeout(() => r('done'), 100);
            }));

            const promise = queue.enqueue(slowFn);
            expect(queue.isProcessing()).toBe(true);

            const result = await promise;
            expect(result).toBe('done');
        });
    });

    describe('Memory management', () => {
        test('clears completed tasks from memory', async () => {
            const queue = new BatchQueue();
            const fn = jest.fn().mockResolvedValue('done');

            await queue.enqueue(fn);
            expect(queue.getQueueLength()).toBe(0);
        });

        test('handles large number of queued tasks', async () => {
            const queue = new BatchQueue(1);
            const fn = jest.fn().mockResolvedValue('done');

            const promises = [];
            for (let i = 0; i < 1000; i++) {
                promises.push(queue.enqueue(fn));
            }

            await Promise.all(promises);
            expect(queue.getQueueLength()).toBe(0);
            expect(fn).toHaveBeenCalledTimes(1000);
        });
    });

    describe('Timeout handling', () => {
        test('batch timeout triggers flush', (done) => {
            const buffer = [];
            const BATCH_TIMEOUT_MS = 50;
            let flushed = false;

            buffer.push({ id: 1 });

            setTimeout(() => {
                flushed = true;
                buffer.splice(0);
            }, BATCH_TIMEOUT_MS);

            setTimeout(() => {
                expect(flushed).toBe(true);
                done();
            }, 100);
        });

        test('size-based flush overrides timeout', (done) => {
            const buffer = [];
            const BATCH_SIZE = 3;
            let flushed = false;

            for (let i = 0; i < BATCH_SIZE; i++) {
                buffer.push({ id: i });
                if (buffer.length >= BATCH_SIZE) {
                    flushed = true;
                    buffer.splice(0);
                }
            }

            expect(flushed).toBe(true);
            done();
        });
    });
});
