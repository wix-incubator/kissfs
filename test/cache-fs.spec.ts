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

    describe(`using slow FileSystem`, () => {
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

    describe(`unexpected error behaviour`, () => {
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

        describe('when a file was created/changed silently, followed by an error', () => {
            it('does not emit `fileCreated` if the file was never cached', async () => {
                (original as any).emit = () => false;
                await original.saveFile(fileName, content);
                await matcher.expect([]);
                (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
                await matcher.expect([]);
            });

            it('emits `fileCreated` if the file was previously cached', async () => {
                await fs.saveFile(fileName, 'foo');
                await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: 'foo'}]);
                (original as any).emit = () => false;
                await original.saveFile(fileName, content);
                await matcher.expect([]);
                (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
                await matcher.expect([{type: 'fileChanged', fullPath: fileName, newContent: content}]);
            });
        });

        it('emits `directoryCreated` if there is not cached dir after error', async () => {
            (original as any).emit = () => false;
            await original.ensureDirectory(dirName);
            await matcher.expect([]);
            await (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
            await matcher.expect([{type: 'directoryCreated', fullPath: dirName}]);
        });

        it('emits `fileDeleted` if there is cached file and no real file after error', async () => {
            await fs.saveFile(fileName, content);
            (original as any).emit = () => false;
            await original.deleteFile(fileName);
            await matcher.expect([{type: 'fileCreated', fullPath: fileName}]);
            await (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
            await matcher.expect([{type: 'fileDeleted', fullPath: fileName}]);
        });

        it('emits `directoryDeleted` if there is cached dir and no real dir after error', async () => {
            await fs.ensureDirectory(dirName);
            (original as any).emit = () => false;
            original.events.removeAllListeners('directoryDeleted');
            await original.deleteDirectory(dirName);
            await matcher.expect([{type: 'directoryCreated', fullPath: dirName}]);
            await (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
            await matcher.expect([{type: 'directoryDeleted', fullPath: dirName}]);
        });

        it('emits `unexpectedError` if cache created with `rescanOnError = false` flag', () => {
            const fs = new CacheFileSystem(original, false);
            const matcher = new EventsMatcher(eventMatcherOptions);
            matcher.track(fs.events, ...fileSystemEventNames);
            (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
            return matcher.expect([{type: 'unexpectedError'}]);
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
