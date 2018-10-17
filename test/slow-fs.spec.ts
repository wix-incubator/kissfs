import { expect } from 'chai';
import { FileSystem } from '../src/api';
import { assertFileSystemContract, content, dirName, fileName } from '../test/implementation-suite';
import { SlowFs } from './slow-fs';

describe('the slow (delayed) file system implementation', () => {
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
            fs = new SlowFs(delay);
        });

        it(`delay the dir creation, reading tree and deleting`, async () => {
            await fs.ensureDirectory(dirName);
            await fs.loadDirectoryTree();
            await fs.stat(dirName);
            await fs.deleteDirectory(dirName);

            expect(Date.now() - startTimestamp).to.be.at.least(delay * 4 * accuracyFactor);
        });

        it(`delay the file saving, reading and deleting`, async () => {
            await fs.saveFile(fileName, content);
            await fs.loadTextFile(fileName);
            await fs.stat(fileName);
            await fs.deleteFile(fileName);

            expect(Date.now() - startTimestamp).to.be.at.least(delay * 4 * accuracyFactor);
        });
    });
});
