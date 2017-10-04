import {expect} from 'chai';
import {
    assertFileSystemContract,
    ignoredDir,
    ignoredFile,
    dirName,
    fileName,
} from './implementation-suite'
import {SlowFs} from '../test-kit/drivers/slow-fs';
import {MemoryFileSystem, TimeoutFileSystem, FileSystem} from '../src/universal';

describe('the timeout file system imeplementation', () => {
    const timeout = 200;

    assertFileSystemContract(() =>
        Promise.resolve(new TimeoutFileSystem(timeout , new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]))),
        {retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10}
    );

    describe(`delayed timeout test`, () => {
        let fs: FileSystem;
        let startTimestamp: number;
        const delay = timeout * 2;

        beforeEach(() => {
            startTimestamp = Date.now();
            fs = new TimeoutFileSystem(timeout, new SlowFs(delay));
        });

        it(`ensureDirectory exit before delay is over`, () => {
            return expect(fs.ensureDirectory(dirName)).to.eventually.be.rejectedWith('timed out')
                .then(() => expect(startTimestamp - Date.now()).to.be.below(delay));
        });

        it(`saveFile exit before delay is over`, () => {
            return expect(fs.saveFile(`${dirName}\\${fileName}`, '#goodnessSquad')).to.eventually.be.rejectedWith('timed out')
                .then(() => expect(startTimestamp-Date.now()).to.be.below(delay));
        });

        it(`deleteFile exit before delay is over`, () => {
            return expect(fs.deleteFile(`${dirName}\\${fileName}`)).to.eventually.be.rejectedWith('timed out')
                .then(() => expect(startTimestamp-Date.now()).to.be.below(delay));
        });

        it(`deleteDirectory exit before delay is over`, () => {
            return expect(fs.deleteDirectory(dirName)).to.eventually.be.rejectedWith('timed out')
                .then(()=>expect(startTimestamp-Date.now()).to.be.below(delay));
        });

        it(`loadTextFile exit before delay is over`, () => {
            return expect(fs.loadTextFile(dirName)).to.eventually.be.rejectedWith('timed out')
                .then(() => expect(startTimestamp-Date.now()).to.be.below(delay));
        });

        it(`loadDirectoryTree exit before delay is over`, () => {
        return expect(fs.loadDirectoryTree()).to.eventually.be.rejectedWith('timed out')
            .then(() => expect(startTimestamp-Date.now()).to.be.below(delay));
        });
    });
});
