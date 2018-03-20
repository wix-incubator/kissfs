import {dir} from 'tmp';
import {mkdirSync, rmdirSync, unlinkSync, writeFileSync} from 'fs';
import {join} from 'path';
import {expect} from 'chai';
import {assertFileSystemContract, content, dirName, fileName, ignoredDir, ignoredFile} from './implementation-suite'
import {EventsMatcher} from './events-matcher';
import {FileSystem, fileSystemEventNames, LocalFileSystem} from '../src/nodejs';
import {NoFeedbackEventsFileSystem} from '../src/no-feedback-events-fs';
import {delayedPromise} from '../src/promise-utils';
import {Events} from "../src/api";

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

        describe('Handling feedback', function () {
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
                await delayedPromise(1);
                writeFileSync(path, 'gaga');
                await matcher.expect([{type: 'fileChanged', fullPath: fileName, newContent: 'gaga'}]);

            });
            it('should not provide feedback when bombarding changes (stress test with nofeedbackFS)', async () => {
                const path = join(testPath, fileName);
                const expectedChangeEvents: Array<Events['fileChanged']> = [];
                writeFileSync(path, content);
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]);

                // this is a magical fix for test flakyness. let the underlying FS calm before bombarding with changes.
                await delayedPromise(100);

                const noFeed = new NoFeedbackEventsFileSystem(fs, {delayEvents: 1, correlationWindow: 10000});
                const nofeedMatcher = new EventsMatcher({
                    alwaysExpectEmpty: true,
                    noExtraEventsGrace: 1000,
                    interval: 100,
                    retries: 40,
                    timeout: 1000
                });
                nofeedMatcher.track(noFeed.events, ...fileSystemEventNames);

                for (let i = 1; i < 200; i++) {
                    await delayedPromise(1);
                    noFeed.saveFile(fileName, 'content:' + i, '' + i);
                    expectedChangeEvents.push({
                        type: 'fileChanged',
                        fullPath: fileName,
                        newContent: 'content:' + i,
                        correlation: '' + i
                    })
                }
                try {
                    await nofeedMatcher.expect([]);
                } catch (e) {
                    console.error('nofeedMatcher failed. printing underlying events');
                    try {
                        await matcher.expect(expectedChangeEvents);
                    } catch (e2) {
                        console.error(e2);
                    }
                    throw e;
                }
            });

        });
    });
});
