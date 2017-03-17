import * as Promise from 'bluebird';

export function waitIfThrow(
    func: Function,
    attempts: number = 5,
    timeout: number = 100
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let counter = attempts;
        (function launcher() {
            try {
                func();
                --counter ? setTimeout(launcher, timeout) : resolve();
            } catch (e) {
                reject(e);
            }
        })();
    });
}
