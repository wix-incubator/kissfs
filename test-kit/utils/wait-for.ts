import * as Promise from 'bluebird';
import isPromise from './is-promise'

export function waitFor(assertion, timeout = 500, pollingInterval = 10) {
    return new Promise(function (resolve, reject) {
        let promisedAssertion: PromiseLike<any> | null = null;
        function tryAssertion() {
            try {
                const returned = assertion();
                if (isPromise(returned)) {
                    promisedAssertion = returned;
                }
            } catch(err) {
                return err;
            }
            return null;
        }

        function isTimeOut() {
            return (new Date().getTime() - t0) >= timeout;
        }

        function nextAttempt() {
            const err = tryAssertion();
            if(err) {
                if(isTimeOut()) {
                    reject(err);
                } else {
                    setTimeout(nextAttempt, pollingInterval);
                }
            } else {
                promisedAssertion ? promisedAssertion.then(() => resolve(), reason => reject(reason)) : resolve();
            }
        }

        const t0 = new Date().getTime();
        nextAttempt();
    });
};
