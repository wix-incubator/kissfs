import {expect} from 'chai';
import {waitIfThrow} from '../drivers/waitIfThrow';

describe('waitIfThrow()', () => {

    let attempts: number;
    let check: boolean;
    function checker() {
        attempts--;
        if (!check) throw new Error();
    }

    beforeEach(() => {
         check = true;
         attempts = 0;
    });

    it('should reject with throwing function', () => {
        setTimeout(() => check = false, 10);
        return expect(waitIfThrow(checker)).to.eventually.rejected;
    });

    it('should resolve', () => {
        return expect(waitIfThrow(checker)).to.eventually.be.fulfilled;
    });

    it('should resolve after 10 attempts', () => {
        attempts = 10;
        return expect(
            waitIfThrow(checker, attempts)
                .then(() => attempts)).to.eventually.be.eq(0);
    });

    it('should resolve after given timeout * (attempts - 1)', () => {
        const start = Date.now();
        const timeout = 100;
        const attempts = 5;
        return expect(
            waitIfThrow(checker, attempts, timeout)
                .then(() => Date.now() - start))
                    .to.eventually.be.at.least(timeout * (attempts - 1));
    });
});
