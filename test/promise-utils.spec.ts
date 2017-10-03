import {expect} from 'chai';
import * as sinon from 'sinon';
import {delayedPromise, timeoutPromise, retryPromise, RetryPromiseOptions} from '../src/promise-utils';

describe('Promise utilities', () => {
    describe('delayedPromise', () => {
        it('resolves after provided the ms', async () => {
            const startTime = Date.now(), delay = 50;

            await delayedPromise(delay);

            expect(Date.now()).to.be.gte(startTime + delay);
        })
    });

    describe('timeoutPromise', () => {
        it('resolves with original value if original promise resolves within time frame', async () => {
            await expect(timeoutPromise(Promise.resolve('test'), 100)).to.eventually.become('test');
        });

        it('rejects with original value if original promise rejects within time frame', async () => {
            await expect(timeoutPromise(Promise.reject('an error'), 100)).to.eventually.be.rejectedWith('an error');
        });

        it('rejects with a timeout message if time is up and original promise is pending', async () => {
            await expect(timeoutPromise(delayedPromise(200), 50)).to.eventually.be.rejectedWith('timed out after 50ms');
        });

        it('allows providing a custom timeout message', async () => {
            await expect(timeoutPromise(delayedPromise(200), 50, 'FAILED!')).to.eventually.be.rejectedWith('FAILED!');
        });
    });

    describe('retryPromise', () => {
        async function verifyCallCount(spy: sinon.SinonSpy, count: number, noExtraEventsGrace: number): Promise<void> {
            expect(spy).to.have.callCount(count);
            await delayedPromise(noExtraEventsGrace); // to catch unwanted calls to provider post fullfillment 
            expect(spy).to.have.callCount(count);
        }

        it('resolves if first run was a success', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 2, interval: 5};
            const promiseProvider = sinon.stub().resolves('value');

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.become('value');
            await verifyCallCount(promiseProvider, 1, retryOptions.interval + 1);
        });

        it('rejects if first run failed, and no retries', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 0, interval: 10};
            const promiseProvider = sinon.stub().rejects(new Error('failed'));

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.rejectedWith('failed');
            await verifyCallCount(promiseProvider, 1, retryOptions.interval + 1);
        });

        it('resolves if a success run was achieved during a retry', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 2, interval: 10};
            const promiseProvider = sinon.stub()
                .onFirstCall().rejects(new Error('first failure'))
                .onSecondCall().rejects(new Error('second failure'))
                .resolves('success');

            const startTime = Date.now();
            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.become('success');
            expect(Date.now(), 'verify interval').to.be.gte(startTime + (retryOptions.interval * 2));
            await verifyCallCount(promiseProvider, 3, retryOptions.interval + 1);
        });

        it('rejects if all tries failed', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 5, interval: 5};
            const promiseProvider = sinon.stub().rejects(new Error('failed'));

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.rejectedWith('failed');
            await verifyCallCount(promiseProvider, 6, retryOptions.interval + 1);
        });

        it('rejects with error of last failed attempt', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 1, interval: 5};
            const promiseProvider = sinon.stub()
                .onFirstCall().rejects(new Error('first failure'))
                .onSecondCall().rejects(new Error('second failure'))
                .rejects(new Error('other failures'));

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.rejectedWith('second failure');
            await verifyCallCount(promiseProvider, 2, retryOptions.interval + 1);

        });

        describe('when provided with a timeout', () => {
            it('verifies timeout is greater than retries*interval', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 10, interval: 10, timeout: 90};
                const promiseProvider = sinon.stub();

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually
                    .be.rejectedWith('timeout (90ms) must be greater than retries (10) times interval (10ms)');
                await verifyCallCount(promiseProvider, 0, retryOptions.interval + 1);
            });

            it('resolves if a success run was achieved during timeout', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 1, interval: 5, timeout: 1500};
                const promiseProvider = sinon.stub()
                    .onFirstCall().rejects(new Error('first failure'))
                    .resolves('success');

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.become('success');
                await verifyCallCount(promiseProvider, 2, retryOptions.interval + 1);
            });

            it('rejects with error of last failed attempt if timeout expires', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 1, interval: 10, timeout: 50};
                const promiseProvider = sinon.stub()
                    .onFirstCall().rejects(new Error('first failure'))
                    .onSecondCall().returns(delayedPromise(2000))

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.be.rejectedWith('first failure');
                await verifyCallCount(promiseProvider, 2, retryOptions.interval + 1);

            });

            it('rejects with default timeout message, if no last failed attempt and timeout expires', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 0, interval: 25, timeout: 50};
                const promiseProvider = sinon.stub().returns(delayedPromise(1000));

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.be.rejectedWith('timed out after 50ms');
                await verifyCallCount(promiseProvider, 1, retryOptions.interval + 1);
            });

            it('rejects with provided timeout message, if no last failed attempt and timeout expires', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 0, interval: 25, timeout: 50, timeoutMessage: 'FAILED'};
                const promiseProvider = sinon.stub().returns(delayedPromise(1000));

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.be.rejectedWith('FAILED');
                await verifyCallCount(promiseProvider, 1, retryOptions.interval + 1);
            });
        });
    });
});
