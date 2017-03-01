import * as Promise from 'bluebird';
import {expect} from 'chai';
import {FileSystem} from '../../src/api';
import {assertFileSystemContract} from '../../test/implementation-suite';
import {SlowFs} from '../drivers/slow-fs';

describe('the slow (delayed) file system imeplementation', () => {
    const delay = 200;
    const accuracyFactor = 0.9;
    assertFileSystemContract(() => Promise.resolve(new SlowFs(delay)), {interval:1, noExtraEventsGrace:10, timeout:30});

    describe(`delayed methods`, () => {
        let fs: FileSystem;
        let startTimestamp: number;
        const dirName = 'dir';
        const fileName = 'foo.txt';
        const content = 'content';

        beforeEach(() => {
            startTimestamp = Date.now();
            return Promise.resolve(new SlowFs(delay)).then(newFs => fs = newFs);
        });

        it(`delay the dir creation, reading tree and deleting`, () => {
            return fs.ensureDirectory(dirName)
                .then(() => fs.loadDirectoryTree())
                .then(() => fs.deleteDirectory(dirName))
                .then(() => expect(Date.now() - startTimestamp).to.be.at.least(delay * 3 * accuracyFactor))
        });

        it(`delay the file saving, reading and deleting`, () => {
            return fs.saveFile(fileName, content)
                .then(() => fs.loadTextFile(fileName))
                .then(() => fs.deleteFile(fileName))
                .then(() => expect(Date.now() - startTimestamp).to.be.at.least(delay * 3 * accuracyFactor))
        });
    });
});
