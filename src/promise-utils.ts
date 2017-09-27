export function timeoutPromise<T>(ms: number, promise: Promise<T>, message = `timed out after ${ms}ms`): Promise<T> {
    return new Promise(function (resolve, reject) {
        setTimeout(() => reject(new Error(message)), ms);
        promise.then(resolve).catch(reject);
    });
}

export function delayedPromise(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
}

export interface RetryPromiseOptions {
    interval: number;
    retries: number;
    timeout?: number;
}

export async function retryPromise<T>(promiseProvider: () => Promise<T>, {interval, retries, timeout}: RetryPromiseOptions): Promise<T> {
    let aborted = false;
    let lastError: Error;
    return new Promise<T>(async (resolve, reject) => {
        timeout && setTimeout(() => {aborted = true; reject(lastError);}, timeout);
        do {
            try {
                return resolve(await promiseProvider())
            } catch (e) {
                lastError = e;
                if (retries > 0) {
                    await delayedPromise(interval);
                }
            }
        } while (!aborted && retries-- > 0);
        reject(lastError);
    })
}
