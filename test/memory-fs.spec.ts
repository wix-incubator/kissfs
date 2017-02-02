import * as Promise from 'bluebird';
import {expect} from 'chai';
import {assertFileSystemContract, ignoredDir, ignoredFile} from './implementation-suite'
import {MemoryFileSystem} from "../src/browser";
import {FileSystem} from '../src/api';

describe('the in memory implementation', function() {

    function getFS() {
        return Promise.resolve(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]))
    }

    assertFileSystemContract(getFS, {interval:1, noExtraEventsGrace:10, timeout:30});

    describe(`ignoring contract`, () => {
        let fs: FileSystem;

        beforeEach(() => {
            return getFS().then(newFs => fs = newFs);
        });

        it(`saving ignored file - fails`, function() {
            return expect(fs.saveFile(ignoredFile, 'foo')).to.be.rejectedWith(Error)
        });

        it(`saving ignored dir - fails`, function() {
            return expect(fs.ensureDirectory(ignoredDir)).to.be.rejectedWith(Error)
        });
    });
});
