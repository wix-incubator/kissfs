export function delayedPromise(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
}

export function timeoutPromise<T>(promise: Promise<T>, ms: number, message = `timed out after ${ms}ms`): Promise<T> {
    return new Promise(function (resolve, reject) {
        setTimeout(() => reject(new Error(message)), ms);
        promise.then(resolve).catch(reject);
    });
}

export interface RetryPromiseOptions {
    interval: number;
    retries: number;
    timeout?: number;
    timeoutMessage?: string;
}

export function retryPromise<T>(
    promiseProvider: () => Promise<T>,
    {interval, retries, timeout, timeoutMessage = `timed out after ${timeout}ms`}: RetryPromiseOptions): Promise<T> {

    const startTime = (new Date).getTime();
    let lastError: Error;
    const isTimeout = () => timeout && (new Date).getTime() >= (startTime + timeout);

    return new Promise(async (resolve, reject) => {
        timeout && setTimeout(() => reject(lastError || new Error(timeoutMessage)), timeout);
        do {
            try {
                return resolve(await promiseProvider());
            } catch (e) {
                lastError = e;
                if ((retries-- > 0) && !isTimeout()) {
                    await delayedPromise(interval);
                } else {
                    reject(lastError);
                    break;
                }
            }
        } while (!isTimeout()); // we can be in a timeout again after being delayed by interval
    });
}
