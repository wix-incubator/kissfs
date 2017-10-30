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

const timeoutSymbol = Symbol('timeout');

export async function retryPromise<T>(
    promiseProvider: () => Promise<T>,
    {interval, retries, timeout, timeoutMessage = `timed out after ${timeout}ms`}: RetryPromiseOptions): Promise<T> {
    if (timeout && timeout <= retries * interval) {
        throw new Error(`timeout (${timeout}ms) must be greater than retries (${retries}) times interval (${interval}ms)`);
    }
    let lastError: Error | undefined;
    const timeoutPromise = timeout && delayedPromise(timeout).then(() => timeoutSymbol);
    do {
        const shouldDelay = interval && lastError !== undefined;
        try {
            if (timeoutPromise) {
                shouldDelay && await Promise.race([delayedPromise(interval), timeoutPromise]);
                const result = await Promise.race([promiseProvider(), timeoutPromise])
                if (result === timeoutSymbol) {
                    lastError = lastError || new Error(timeoutMessage);
                    break;
                }
                return result as T;
            } else {
                shouldDelay && await delayedPromise(interval);
                return await promiseProvider();
            }
        } catch (e) {
            lastError = e;
        }
    } while (retries-- > 0);
    throw lastError;
}
