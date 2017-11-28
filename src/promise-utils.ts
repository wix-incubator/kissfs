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

const never: Promise<any> = new Promise(() => void 0);

export async function retryPromise<T>(promiseProvider: () => Promise<T>,
                                      {interval, retries, timeout, timeoutMessage = `timed out after ${timeout}ms`}: RetryPromiseOptions): Promise<T> {
    if (!timeout && !retries) {
        return await promiseProvider();
    }
    if (timeout && timeout <= retries * interval) {
        return Promise.reject(`timeout (${timeout}ms) must be greater than retries (${retries}) times interval (${interval}ms)`)
    }
    const raceWithTimeout = [never, never];
    if (timeout) {
        raceWithTimeout[1] = delayedPromise(timeout).then(() => Promise.reject(new Error(timeoutMessage)));
    }
    let iterations = retries ? retries + 1 : Number.MAX_SAFE_INTEGER;
    let lastError: Error | null = null;
    while (iterations-- > 0) {
        try {
            raceWithTimeout[0] = promiseProvider();
            return await Promise.race(raceWithTimeout);
        } catch (e) {
            if (e.message === timeoutMessage) {
                throw lastError || e;
            }
            lastError = e;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw lastError || new Error(timeoutMessage);
}
