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

const uniqueObj = {}; // used to identify timeout in retryPromise

export async function retryPromise<T>(
    promiseProvider: () => Promise<T>,
    {interval, retries, timeout, timeoutMessage = `timed out after ${timeout}ms`}: RetryPromiseOptions): Promise<T> {
    if (timeout && timeout <= retries * interval) {
        throw new Error(`timeout (${timeout}ms) must be greater than retries (${retries}) times interval (${interval}ms)`);
    }
    let lastError: Error | undefined;
    let retriesLeft = retries;
    const timeoutReject = timeout && delayedPromise(timeout).then(() => Promise.reject(uniqueObj));
    do {
        const shouldDelay = interval && retriesLeft !== retries; // first run is not delayed
        try {
            if (timeoutReject) {
                shouldDelay && await Promise.race([delayedPromise(interval), timeoutReject]);
                return await Promise.race([promiseProvider(), timeoutReject])
            } else {
                shouldDelay && await delayedPromise(interval);
                return await promiseProvider();
            }
        } catch (e) {
            if (e === uniqueObj) { // only retry if not a timeout
                retriesLeft = 0;
                lastError = lastError || new Error(timeoutMessage);
            } else {
                lastError = e;
            }
        }
    } while (retriesLeft-- > 0);
    throw lastError;
}
