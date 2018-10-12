import {InternalEventsEmitter} from '../src/utils';
import {expect} from 'chai';
import {EventsMatcher} from './events-matcher';
import {SlowFs} from './slow-fs';

import {CacheFileSystem, FileSystem, fileSystemEventNames, MemoryFileSystem} from '../src/universal';

import {
    assertFileSystemContract,
    assertFileSystemSyncContract,
    content,
    dirName,
    fileName,
} from './implementation-suite';
import {spy} from 'sinon';
import {FileSystemReadSync} from '../src/api';

const existingFileName = 'existing_' + fileName;
const existingDirName = 'existing_' + dirName;

function testCacheReadMethod(options: CacheFileSystem.Options, methodName: Exclude<keyof FileSystemReadSync, 'events' | 'baseUrl'>, args: any[]) {
    it(`${methodName}(${args.map(a => JSON.stringify(a)).join(', ')}) reflects underlying fs and uses cache on second call`, async () => {
        const original = new MemoryFileSystem('', {
            content: {
                [existingDirName]: {},
                [existingFileName]: 'foo',
            }
        });
        const fs = new CacheFileSystem(original, options);
        const originalMethod: Function = original[methodName].bind(original);
        const cacheMethod: Function = fs[methodName].bind(fs);
        const spyMethod = spy(originalMethod);
        original[methodName] = spyMethod;
        expect(await cacheMethod(...args)).to.eql(await originalMethod(...args));
        expect(spyMethod).to.have.callCount(1);
        spyMethod.resetHistory();
        expect(await cacheMethod(...args)).to.eql(await originalMethod(...args));
        expect(spyMethod).to.have.callCount(0);
    });
}

describe(`the cache file system proxy`, () => {
    const eventMatcherOptions: EventsMatcher.Options = {retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10};

    assertFileSystemContract(
        async () => new CacheFileSystem(new MemoryFileSystem()),
        eventMatcherOptions
    );

    assertFileSystemSyncContract(
        async () => new CacheFileSystem(new MemoryFileSystem()),
        eventMatcherOptions
    );

    describe(`using slow FileSystem (performance acceptance test)`, () => {
        const timeout = 200;
        let fs: CacheFileSystem;
        let slow: SlowFs;
        let startTimestamp: number;
        let matcher: EventsMatcher;

        beforeEach(() => {
            startTimestamp = Date.now();
            slow = new SlowFs(timeout);
            fs = new CacheFileSystem(slow);
            matcher = new EventsMatcher(eventMatcherOptions);
            matcher.track(fs.events, ...fileSystemEventNames);
        });

        it('loads file faster after it has been saved', async () => {
            await fs.saveFile(fileName, content);
            await fs.loadTextFile(fileName);
            await expect(Date.now() - startTimestamp).to.be.lessThan(timeout * 2);
        });

        it('loads file faster after it has been saved from outside', async () => {
            const onFileCreated = new Promise(resolve => {
                fs.events.once('fileCreated', async () => {
                    await fs.loadTextFile(fileName);
                    resolve(Date.now() - startTimestamp);
                });
            });

            slow.saveFile(fileName, content);
            return expect(await onFileCreated).to.be.lessThan(timeout * 2);
        });

        it('loads tree faster after it has been loaded before', async () => {
            await fs.loadDirectoryTree();
            await fs.loadDirectoryTree();
            await expect(Date.now() - startTimestamp).to.be.lessThan(timeout * 2);
        });

        it('stat directory faster after it has been cached before', async () => {
            await fs.ensureDirectory(dirName);
            await fs.stat(dirName);
            await expect(Date.now() - startTimestamp).to.be.lessThan(timeout * 2);
        });

        it('stat file faster after stat has run on it before', async () => {
            await fs.saveFile(fileName, content);
            await fs.stat(fileName);
            await expect(Date.now() - startTimestamp).to.be.lessThan(timeout * 2);
        });
    });

    testCacheReadMethod({}, 'loadTextFile', [existingFileName]);
    testCacheReadMethod({}, 'loadDirectoryChildren', ['']);
    testCacheReadMethod({}, 'loadDirectoryChildren', [existingDirName]);
    testCacheReadMethod({}, 'loadDirectoryTree', []);
    testCacheReadMethod({}, 'loadDirectoryTree', [existingDirName]);
    testCacheReadMethod({}, 'stat', [existingFileName]);
    testCacheReadMethod({}, 'stat', [existingDirName]);

    describe(`with propagateSyncRead = true`, () => {
        const options = {propagateSyncRead: true};
        it('breaks if not provided with sync file system', async () => {
            const nonSyncFs: FileSystem = new SlowFs(1);
            expect(() => new CacheFileSystem(nonSyncFs, options)).to.throw(Error);
        });
        testCacheReadMethod(options, 'loadTextFileSync', [existingFileName]);
        testCacheReadMethod(options, 'loadDirectoryChildrenSync', ['']);
        testCacheReadMethod(options, 'loadDirectoryChildrenSync', [existingDirName]);
        testCacheReadMethod(options, 'loadDirectoryTreeSync', []);
        testCacheReadMethod(options, 'loadDirectoryTreeSync', [existingDirName]);
        testCacheReadMethod(options, 'statSync', [existingFileName]);
        testCacheReadMethod(options, 'statSync', [existingDirName]);
        testCacheReadMethod(options, 'loadDirectoryContentSync', []);
        testCacheReadMethod(options, 'loadDirectoryContentSync', [existingDirName]);
    });

    describe(`unexpected error behavior`, () => {
        let fs: FileSystem;
        let original: FileSystem;
        let matcher: EventsMatcher;

        beforeEach(() => {
            original = new MemoryFileSystem();
            fs = new CacheFileSystem(original);
            matcher = new EventsMatcher({
                retries: 30,
                interval: 5,
                noExtraEventsGrace: 150,
                timeout: 300
            });
            matcher.track(fs.events, ...fileSystemEventNames);
        });

        it('emits `unexpectedError` when reSyncOnError option is false', () => {
            const fs = new CacheFileSystem(original, {reSyncOnError: false});
            const matcher = new EventsMatcher(eventMatcherOptions);
            matcher.track(fs.events, ...fileSystemEventNames);
            (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
            return matcher.expect([{type: 'unexpectedError'}]);
        });

        describe('recovering from missed changes in underlying filesystem', () => {

            beforeEach('turn off notifications from underlying fs and set up cache', async () => {
                (original as any).emit = () => false;
                await fs.ensureDirectory(existingDirName);
                await fs.loadDirectoryChildren(existingDirName);
                await fs.saveFile(existingFileName, 'foo');
                await matcher.expect([
                    {type: 'directoryCreated', fullPath: existingDirName},
                    {type: 'fileCreated', fullPath: existingFileName, newContent: 'foo'}
                ]);
            });

            function emitErrorFromUnderlyingFs() {
                (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
            }

            it('does not emit `fileCreated` if the file was never cached', async () => {
                await original.saveFile(fileName, content);
                await matcher.expect([]);
                emitErrorFromUnderlyingFs();
                await matcher.expect([]);
            });

            it('emits `fileChanged` if the file was previously cached', async () => {
                await original.saveFile(existingFileName, content);
                await matcher.expect([]);
                emitErrorFromUnderlyingFs();
                await matcher.expect([{type: 'fileChanged', fullPath: existingFileName, newContent: content}]);
            });

            it('emits `fileDeleted` if there is cached file and no real file after error', async () => {
                await original.deleteFile(existingFileName);
                await matcher.expect([]);
                emitErrorFromUnderlyingFs();
                await matcher.expect([{type: 'fileDeleted', fullPath: existingFileName}]);
            });

            it('emits `directoryCreated` if there is not cached dir after error', async () => {
                await original.ensureDirectory(existingDirName + '/' + dirName);
                await matcher.expect([]);
                emitErrorFromUnderlyingFs();
                await matcher.expect([{type: 'directoryCreated', fullPath: existingDirName + '/' + dirName}]);
            });

            it('emits `directoryDeleted` if there is cached dir and no real dir after error', async () => {
                await original.deleteDirectory(existingDirName);
                await matcher.expect([]);
                emitErrorFromUnderlyingFs();
                await matcher.expect([{type: 'directoryDeleted', fullPath: existingDirName}]);
            });

        });
    });

    describe(`lazyness`, () => {
        let fs: FileSystem;
        let original: FileSystem;
        let matcher: EventsMatcher;

        beforeEach(() => {
            original = new MemoryFileSystem('', {
                content: {
                    foo: {}
                }
            });
            fs = new CacheFileSystem(original);
            matcher = new EventsMatcher({
                retries: 30,
                interval: 5,
                noExtraEventsGrace: 150,
                timeout: 300
            });
            matcher.track(fs.events, ...fileSystemEventNames);
        });

        it('does not load underlying fs tree more than needs to', async () => {
            spy(original, 'loadDirectoryTree');
            fs.loadDirectoryTree('foo');
            expect(original.loadDirectoryTree).to.have.callCount(1);
            expect(original.loadDirectoryTree).to.have.been.calledWithExactly('foo');
        });

        it('does not load underlying fs tree more than needs to', async () => {
            spy(original, 'loadDirectoryChildren');
            fs.loadDirectoryChildren('foo');
            expect(original.loadDirectoryChildren).to.have.callCount(1);
            expect(original.loadDirectoryChildren).to.have.been.calledWithExactly('foo');
        });
    });
});
