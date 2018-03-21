import {expect} from 'chai';
import {FileSystem} from '../src/api';
import {assertFileSystemContract, content, dirName, fileName} from '../test/implementation-suite'
import {SlowFs} from './slow-fs';

describe.only('the slow (delayed) file system implementation', () => {
    const delay = 40;
    const accuracyFactor = 0.9;
    assertFileSystemContract(async () => new SlowFs(delay), {
        retries: 15,
        interval: 2,
        timeout: 40,
        noExtraEventsGrace: 10
    });

    describe(`delayed methods`, () => {
        let fs: FileSystem;
        let startTimestamp: number;

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
