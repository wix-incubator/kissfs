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

export async function retryPromise<T>(promiseProvider: () => Promise<T>,
                                      {interval, retries, timeout, timeoutMessage = `timed out after ${timeout}ms`}: RetryPromiseOptions): Promise<T> {
    if (timeout) {
        if (timeout <= retries * interval) {
            return Promise.reject(`timeout (${timeout}ms) must be greater than retries (${retries}) times interval (${interval}ms)`)
        }
        const timeoutPromise = delayedPromise(timeout).then(() => Promise.reject(new Error(timeoutMessage)));

        let lastError: Error | null = null;

        while (true) {
            try {
                return await Promise.race([promiseProvider(), timeoutPromise]);
            } catch (e) {
                if (e.message === timeoutMessage) {
                    throw lastError || e;
                }
                lastError = e;
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
    } else if (retries > 0){
        let iterations = retries + 1;
        let lastError: Error | null = null;
        while (iterations-- > 0) {
            try {
                return await promiseProvider();
            } catch (e) {
                lastError = e;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        throw lastError || new Error(timeoutMessage);

    } else {
        return await promiseProvider();
    }
}
