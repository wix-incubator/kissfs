import {expect} from 'chai';
import * as sinon from 'sinon';
import {delayedPromise, timeoutPromise, retryPromise, RetryPromiseOptions} from '../src/promise-utils';

describe('Promise utilities', () => {
    describe('delayedPromise', () => {
        it('resolves after provided the ms', async () => {
            const startTime = (new Date).getTime(), delay = 50;

            await delayedPromise(delay);

            expect((new Date).getTime()).to.be.gte(startTime + delay);
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
        it('resolves if first run was a success', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 2, interval: 5};
            const promiseProvider = sinon.stub().resolves('value');

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.become('value');
            await delayedPromise(20); // to catch unwanted calls to provider post fullfillment 
            await delayedPromise(retryOptions.interval * 2);
            expect(promiseProvider).to.have.callCount(1);
        });

        it('rejects if first run failed, and no retries', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 0, interval: 10};
            const promiseProvider = sinon.stub().rejects(new Error('failed'));

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.rejectedWith('failed');

            await delayedPromise(retryOptions.interval * 2);
            expect(promiseProvider).to.have.callCount(1);
        });

        it('resolves if a success run was achieved during a retry', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 2, interval: 10};
            const promiseProvider = sinon.stub()
                .onFirstCall().rejects(new Error('first failure'))
                .onSecondCall().rejects(new Error('second failure'))
                .resolves('success');

            const startTime = (new Date).getTime();

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.become('success');
            expect((new Date).getTime(), 'verify interval').to.be.gte(startTime + (retryOptions.interval * 2));
            await delayedPromise(retryOptions.interval * 2);
            expect(promiseProvider).to.have.callCount(3);
        });

        it('rejects if all tries failed', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 5, interval: 5};
            const promiseProvider = sinon.stub().rejects(new Error('failed'));

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.rejectedWith('failed');

            await delayedPromise(retryOptions.interval * 2);
            expect(promiseProvider).to.have.callCount(6);
        });

        it('rejects with error of last failed attempt', async () => {
            const retryOptions: RetryPromiseOptions = {retries: 1, interval: 5};
            const promiseProvider = sinon.stub()
                .onFirstCall().rejects(new Error('first failure'))
                .onSecondCall().rejects(new Error('second failure'))
                .rejects(new Error('other failures'));

            await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.rejectedWith('second failure');
            await delayedPromise(retryOptions.interval * 2);
            expect(promiseProvider).to.have.callCount(2);
        });

        describe('when provided with a timeout', () => {
            it('resolves if a success run was achieved during timeout', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 1, interval: 5, timeout: 100};
                const promiseProvider = sinon.stub()
                    .onFirstCall().rejects(new Error('first failure'))
                    .resolves('success');

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.become('success');
                await delayedPromise(retryOptions.interval * 2);
                expect(promiseProvider).to.have.callCount(2);
            });

            it('rejects with error of last failed attempt if timeout expires', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 3, interval: 50, timeout: 90};
                const promiseProvider = sinon.stub()
                    .onFirstCall().rejects(new Error('first failure'))
                    .onSecondCall().rejects(new Error('second failure'))
                    .rejects(new Error('other failure'));

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually.be.rejectedWith('second failure');
                await delayedPromise(retryOptions.interval * 2);
                expect(promiseProvider).to.have.callCount(2);
            });

            it('rejects with default timeout message, if no last failed attempt and timeout expires', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 0, interval: 25, timeout: 50};
                const promiseProvider = sinon.stub().returns(delayedPromise(1000));

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually
                    .be.rejectedWith('timed out after 50ms');
                await delayedPromise(retryOptions.interval * 2);
                expect(promiseProvider).to.have.callCount(1);
            });

            it('rejects with provided timeout message, if no last failed attempt and timeout expires', async () => {
                const retryOptions: RetryPromiseOptions = {retries: 0, interval: 25, timeout: 50, timeoutMessage: 'FAILED'};
                const promiseProvider = sinon.stub().returns(delayedPromise(1000));

                await expect(retryPromise(promiseProvider, retryOptions)).to.eventually
                    .be.rejectedWith('FAILED');
                await delayedPromise(retryOptions.interval * 2);
                expect(promiseProvider).to.have.callCount(1);
            });
        });
    });
});
