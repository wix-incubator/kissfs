import {assertFileSystemContract, assertFileSystemSyncContract, ignoredDir, ignoredFile} from './implementation-suite'
import {MemoryFileSystem, Directory} from "../src/universal";
import {expect} from "chai";

const content = {
    "a.file": "hello",
    "src": {
        "a.ts": "a",
        "b.js": "b",
        "nested": {
            "file.zag": "nested-file"
        }
    }
};

function assertContent(fs: MemoryFileSystem) {
    expect(fs.loadTextFileSync('a.file')).to.be.equal('hello');
    expect(fs.loadTextFileSync('src/a.ts')).to.be.equal('a');
    expect(fs.loadTextFileSync('src/b.js')).to.be.equal('b');
    expect(fs.loadTextFileSync('src/nested/file.zag')).to.be.equal('nested-file');
}

describe(`the in-memory implementation`, function () {
    assertFileSystemContract(
        () => Promise.resolve(new MemoryFileSystem(undefined, {ignore: [ignoredDir, ignoredFile]})),
        {retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10}
    );
    assertFileSystemSyncContract(
        () => Promise.resolve(new MemoryFileSystem(undefined, {ignore: [ignoredDir, ignoredFile]})),
        {retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10}
    );

    describe(`constructor options`, function () {
        it(`content sets initial content`, function () {
            const fs = new MemoryFileSystem(undefined, {content});
            assertContent(fs);
        });

        it(`model sets initial content`, function () {
            const model = Directory.fromContent(content);
            const fs = new MemoryFileSystem(undefined, {model});
            assertContent(fs);
        });

        it(`model sets internal live model`, function () {
            const newFilePath = 'foo/bar/file';
            const newContent = 'new file';

            const model = Directory.fromContent(content);
            new MemoryFileSystem(undefined, {model}).saveFile(newFilePath, newContent);

            expect(model).to.not.eql(Directory.fromContent(content));
            expect(new MemoryFileSystem(undefined, {model}).loadTextFileSync(newFilePath)).to.be.equal(newContent);
        });
    });

    describe('static addContent()', () => {
        it('adds content to an existing memory files system', async () => {
            const fs = new MemoryFileSystem('', {content: {"a.file": 'hello'}});
            MemoryFileSystem.addContent(fs, content.src, 'src');
            const newContent = fs.loadDirectoryContentSync();

            // a trick to structural equality with no regards to ordering in arrays
            // (a contains b && b contains a) === a equals b
            expect(newContent).to.containSubset(content);
            expect(content).to.containSubset(newContent);
        });
    });
});
