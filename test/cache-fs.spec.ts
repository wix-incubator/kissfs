import {EventEmitter} from 'eventemitter3';
import {InternalEventsEmitter} from '../src/utils';
import {expect} from 'chai';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {SlowFs} from '../test-kit/drivers/slow-fs';

import {
    FileSystem,
    fileSystemEventNames,
    CacheFileSystem,
    MemoryFileSystem
} from '../src/universal';

import {
    assertFileSystemContract,
    ignoredDir,
    ignoredFile,
    fileName,
    dirName,
    content
} from './implementation-suite';

describe(`the cache file system implementation`, () => {
    const eventMatcherOptions: EventsMatcher.Options = { retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10 };

    assertFileSystemContract(
        async () => new CacheFileSystem(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile])),
        eventMatcherOptions
    );

    describe(`using slow FileSystem`, () => {
        const timeout = 200;

        let fs: FileSystem;
        let slow: FileSystem;
        let startTimestamp: number;
        let matcher: EventsMatcher;

        beforeEach(() => {
            startTimestamp = Date.now();
            slow = new SlowFs(timeout)
            fs = new CacheFileSystem(slow)
            matcher = new EventsMatcher(eventMatcherOptions);
            matcher.track(fs.events as any as EventEmitter, ...fileSystemEventNames)
        });


        it('loads file faster after it has been saved', () => {
            return fs.saveFile(fileName, content)
                .then(() => fs.loadTextFile(fileName))
                .then(() => expect(Date.now() - startTimestamp).to.be.lessThan(timeout * 2));
        })

        it('loads file faster after it has been saved from outside', () => {
            const onFileCreated = new Promise(resolve => {
                    fs.events.once('fileCreated', () => {
                        fs.loadTextFile(fileName)
                            .then(() => resolve(Date.now() - startTimestamp))
                    })
                })

            slow.saveFile(fileName, content)
            return expect(onFileCreated).to.be.eventually.lessThan(timeout * 2)

        })

        it('loads tree faster after it has been loaded before', () => {
            return fs.loadDirectoryTree()
                .then(() => fs.loadDirectoryTree())
                .then(() => expect(Date.now() - startTimestamp).to.be.lessThan(timeout * 2))
        })
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
            matcher.track(fs.events as any as EventEmitter, ...fileSystemEventNames)
        });

        it('emits `fileCreated` if there is not cached file after error', () => {
            original.events.removeAllListeners('fileCreated')
            return original.saveFile(fileName, content)
                .then(() => matcher.expect([]))
                .then(() => (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'}))
                .then(() => matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]))
        })

        it('emits `directoryCreated` if there is not cached dir after error', () => {
            original.events.removeAllListeners('directoryCreated');
            return original.ensureDirectory(dirName)
                .then(() => matcher.expect([]))
                .then(() => (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'}))
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath: dirName}]))
        })

        it('emits `fileDeleted` if there is cached file and no real file after error', () => {
            return fs.saveFile(fileName, content).then(() => {
                original.events.removeAllListeners('fileDeleted');
                return original.deleteFile(fileName)
                    .then(() => matcher.expect([{type: 'fileCreated', fullPath: fileName}]))
                    .then(() => (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'}))
                    .then(() => matcher.expect([{type: 'fileDeleted', fullPath: fileName}]))

            })
        })

        it('emits `directoryDeleted` if there is cached dir and no real dir after error', () => {
            return fs.ensureDirectory(dirName).then(() => {
                original.events.removeAllListeners('directoryDeleted');
                return original.deleteDirectory(dirName)
                    .then(() => matcher.expect([{type: 'directoryCreated', fullPath: dirName}]))
                    .then(() => (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'}))
                    .then(() => matcher.expect([{type: 'directoryDeleted', fullPath: dirName}]))
            })
        })

        it('emits `unexpectedError` if cache created with `rescanOnError = false` flag', () => {
            const fs = new CacheFileSystem(original, false);
            const matcher = new EventsMatcher(eventMatcherOptions);
            matcher.track(fs.events as any as EventEmitter, ...fileSystemEventNames);
            (original.events as InternalEventsEmitter).emit('unexpectedError', {type: 'unexpectedError'});
            return matcher.expect([{type: 'unexpectedError'}]);
        })
    });
});
