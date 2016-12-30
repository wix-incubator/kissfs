import * as Promise from 'bluebird';

export function waitFor(assertion, timeout = 500, pollingInterval = 10) {
    return new Promise(function (resolve, reject) {
        function tryAssertion() {
            try {
                assertion();
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
                resolve();
            }
        }

        const t0 = new Date().getTime();
        nextAttempt();
    });
};
