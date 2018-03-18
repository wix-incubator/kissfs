import {dir} from 'tmp';
import {mkdirSync, rmdirSync, unlinkSync, writeFileSync} from 'fs';
import {join} from 'path';
import {expect} from 'chai';
import {assertFileSystemContract, content, dirName, fileName, ignoredDir, ignoredFile} from './implementation-suite'
import {EventsMatcher} from './events-matcher';
import {FileSystem, fileSystemEventNames, LocalFileSystem} from '../src/nodejs';

describe(`the local filesystem implementation`, () => {
    let dirCleanup: () => void, rootPath: string, testPath: string;
    let counter = 0;
    let disposableFileSystem: LocalFileSystem;

    before(done => {
        dir({unsafeCleanup: true}, (_err, path, cleanupCallback) => {
            dirCleanup = cleanupCallback;
            rootPath = path;
            done();
        })
    });
    after(() => {
        try {
            dirCleanup();

        } catch (e) {
            console.log('cleanup error', e);
        }
    });
    afterEach(() => {
        // if beforeEach fails, disposableFileSystem can stay undefined
        disposableFileSystem && disposableFileSystem.dispose();
    });

    function getFS() {
        testPath = join(rootPath, 'fs_' + (counter++));
        mkdirSync(testPath);
        disposableFileSystem = new LocalFileSystem(
            testPath,
            [ignoredDir, ignoredFile]
        );
        return disposableFileSystem.init();
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        retries: 40,
        interval: 50,
        timeout: 2500,
        noExtraEventsGrace: 150
    };
    assertFileSystemContract(getFS, eventMatcherOptions);
    describe(`external changes`, () => {
        let fs: FileSystem;
        let matcher: EventsMatcher;
        beforeEach(() => {
            matcher = new EventsMatcher(eventMatcherOptions);
            return getFS().then(newFs => {
                fs = newFs;
                matcher.track(fs.events, ...fileSystemEventNames);
            });
        });

        it(`handles dir creation`, () => {
            const path = join(testPath, dirName);
            mkdirSync(path);
            return expect(fs.loadDirectoryTree())
                .to.eventually.have.property('children').eql([
                    {children: [], fullPath: dirName, name: dirName, type: 'dir'}
                ]);
        });

        it(`handles dir deletion`, () => {
            const path = join(testPath, dirName);
            mkdirSync(path);
            rmdirSync(path);
            return expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([]);
        });

        it(`handles file creation`, () => {
            const path = join(testPath, fileName);
            writeFileSync(path, content);
            return expect(fs.loadTextFile(fileName)).to.eventually.equals(content);
        });

        it(`handles file deletion`, () => {
            const path = join(testPath, fileName);
            writeFileSync(path, content);
            unlinkSync(path);
            return expect(fs.loadTextFile(fileName)).to.eventually.be.rejected;
        });

        it(`handles file change`, () => {
            const path = join(testPath, fileName);
            const newContent = `_${content}`;
            writeFileSync(path, content);
            return matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}])
                .then(() => {
                    writeFileSync(path, newContent);
                    return Promise.resolve();
                })
                .then(() => expect(fs.loadTextFile(fileName)).to.eventually.equals(newContent));
        });

        it(`ignores events from ignored dir`, () => {
            mkdirSync(join(testPath, ignoredDir))
            return matcher.expect([])
        });

        it(`ignores events from ignored file`, () => {
            mkdirSync(join(testPath, dirName))
            return matcher.expect([{type: 'directoryCreated', fullPath: dirName}])
                .then(() => writeFileSync(join(testPath, ignoredFile), content))
                .then(() => matcher.expect([]))
        });

        it(`loadDirectoryTree() ignores ignored folder and file`, () => {
            const expectedStructure = {
                name: '',
                type: 'dir',
                fullPath: '',
                children: [{name: dirName, type: 'dir', fullPath: dirName, children: []}]
            };
            mkdirSync(join(testPath, ignoredDir))
            mkdirSync(join(testPath, dirName))
            writeFileSync(join(testPath, ignoredFile), content)
            return expect(fs.loadDirectoryTree()).to.eventually.deep.equal(expectedStructure)
        });

        it(`loadDirectoryTree() ignores ignored folder with special characters`, () => {
            const expectedStructure = {
                name: '',
                type: 'dir',
                fullPath: '',
                children: [{name: dirName, type: 'dir', fullPath: dirName, children: []}]
            };
            mkdirSync(join(testPath, ignoredDir))
            mkdirSync(join(testPath, ignoredDir, 'name-with-dashes'))
            mkdirSync(join(testPath, ignoredDir, 'name-with-dashes', '.name_starts_with_dot'))
            mkdirSync(join(testPath, ignoredDir, 'name-with-dashes', '.name_starts_with_dot', '.name_starts_with_dot'))
            mkdirSync(join(testPath, dirName))
            return expect(fs.loadDirectoryTree()).to.eventually.deep.equal(expectedStructure)
        });

        it(`ignores events in dot-folders and files`, () => {
            mkdirSync(join(testPath, ignoredDir));
            mkdirSync(join(testPath, ignoredDir, `.${dirName}`));
            writeFileSync(join(testPath, ignoredDir, `.${dirName}`, `.${fileName}`), content);

            return matcher.expect([]);
        });

        it(`loading existed ignored file - fails`, function () {
            mkdirSync(join(testPath, dirName))
            writeFileSync(join(testPath, ignoredFile), content)

            return expect(fs.loadTextFile(ignoredFile)).to.be.rejectedWith(Error)
        });

        it(`emits 'unexpectedError' if 'loadTextFile' rejected in watcher 'add' callback`, () => {
            fs.loadTextFile = () => Promise.reject('go away!');
            const path = join(testPath, fileName);
            writeFileSync(path, content);
            return matcher.expect([{type: 'unexpectedError'}]);
        });

        it(`emits 'unexpectedError' if 'loadTextFile' rejected in watcher 'change' callback`, () => {
            return fs.saveFile(fileName, content)
                .then(() => fs.loadTextFile = () => Promise.reject('go away!'))
                .then(() => fs.saveFile(fileName, `_${content}`))
                .then(() => matcher.expect([{type: 'unexpectedError'}]))
        });
    });
});
