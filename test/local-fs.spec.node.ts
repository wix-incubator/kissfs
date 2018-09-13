import {dir} from 'tmp';
import {mkdirSync, rmdirSync, unlinkSync, writeFileSync} from 'fs';
import {join} from 'path';
import {expect} from 'chai';
import {
    assertFileSystemContract,
    assertFileSystemSyncContract,
    content,
    dirName,
    fileName
} from './implementation-suite'
import {EventsMatcher} from './events-matcher';
import {FileSystem, fileSystemEventNames, LocalFileSystem} from '../src/nodejs';

const eventMatcherOptions = {
    retries: 20,
    interval: 25,
    timeout: 1500,
    noExtraEventsGrace: 150
};

const fileSystemOptions: LocalFileSystem.Options = {
    interval: 100,
    retries: 3,
    correlationWindow: eventMatcherOptions.noExtraEventsGrace * 3,
    noiseReduceWindow: eventMatcherOptions.noExtraEventsGrace * 2 // eventMatcherOptions.timeout * 2.5
};


describe(`the local filesystem implementation`, () => {
    let dirCleanup: () => void;
    let rootPath: string;
    let testPath: string;
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
        disposableFileSystem = new LocalFileSystem(testPath, fileSystemOptions);
        return disposableFileSystem.init();
    }

    assertFileSystemContract(getFS, eventMatcherOptions);

    assertFileSystemSyncContract(getFS, eventMatcherOptions);

    describe(`Local fs tests`, () => {
        let fs: FileSystem;
        let matcher: EventsMatcher;
        beforeEach(async () => {
            matcher = new EventsMatcher(eventMatcherOptions);
            fs = await getFS();
            matcher.track(fs.events, ...fileSystemEventNames);
        });

        describe(`external changes`, () => {
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

            it(`handles file change`, async () => {
                const path = join(testPath, fileName);
                const newContent = `_${content}`;
                writeFileSync(path, content);
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]);
                writeFileSync(path, newContent);
                expect(await fs.loadTextFile(fileName)).to.equal(newContent);
            });
        });

        describe(`events with 'newContent'`, () => {
            it(`emits 'unexpectedError' if 'loadTextFile' rejected in watcher 'add' callback`, () => {
                fs.loadTextFile = () => Promise.reject('go away!');
                const path = join(testPath, fileName);
                writeFileSync(path, content);
                return matcher.expect([{type: 'unexpectedError'}]);
            });

            it(`emits 'unexpectedError' if 'loadTextFile' rejected in watcher 'change' callback`, async () => {
                await fs.saveFile(fileName, content);
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]);
                fs.loadTextFile = () => Promise.reject('go away!');
                await fs.saveFile(fileName, `_${content}`);
                await matcher.expect([{type: 'unexpectedError'}]);
            });

            it(`emits exactly one 'change' event if 'loadTextFile' returns same content on multiple change events (unit for stress scenario)`, async () => {
                await fs.saveFile(fileName, content);
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]);
                const newContent = `newContent`;
                fs.loadTextFile = async () => newContent;
                await fs.saveFile(fileName, '123');
                await matcher.expect([{type: 'fileChanged', fullPath: fileName, newContent: newContent}]);
                await fs.saveFile(fileName, '456');
                await matcher.expect([]);
                await fs.saveFile(fileName, '789');
                await matcher.expect([]);
            });

        });

        describe('events noise', function () {
            fileSystemEventNames.forEach(type => {
                it(`de-dupe events of type ${type}`, async () => {
                    const ev1 = {type, fullPath: 'foo'};
                    const ev2 = {type, fullPath: 'foo'};
                    (fs as any).eventsManager.emit(ev1);
                    await matcher.expect([ev1]);
                    (fs as any).eventsManager.emit(ev2);
                    await matcher.expect([]);
                });
            });
            it('should dispatch events for empty files', async () => {
                const path = join(testPath, fileName);
                writeFileSync(path, content);
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]);

                writeFileSync(path, '');
                await matcher.expect([{type: 'fileChanged', fullPath: fileName, newContent: ''}]);
            });
            it('should not dispatch events for empty files if another change is detected within buffer time', async () => {
                const path = join(testPath, fileName);
                writeFileSync(path, content);
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]);

                writeFileSync(path, '');
                await matcher.expect([]);
                writeFileSync(path, 'gaga');
                await matcher.expect([{type: 'fileChanged', fullPath: fileName, newContent: 'gaga'}]);

            });
        });
    });
});
