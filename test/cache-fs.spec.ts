import {EventEmitter} from 'eventemitter3';
import * as Promise from 'bluebird';
import {expect} from 'chai';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {SlowFs} from '../test-kit/drivers/slow-fs';
import {FileSystem} from '../src/api';
import {CacheFs} from '../src/cache-fs';
import {MemoryFileSystem} from '../src/memory-fs';
import {assertFileSystemContract, ignoredDir, ignoredFile} from './implementation-suite';

describe(`the cache file system implementation`, () => {

    assertFileSystemContract(
        () => Promise.resolve(new CacheFs(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]))),
        {
            interval: 1,
            timeout: 30
        }
    );

    describe(`using slow FileSystem`, () => {
        const fileName = 'foo.txt';
        const content = 'content';
        const timeout = 200;

        let timer;
        let fs: FileSystem;
        let slow: FileSystem;
        let startTimestamp: number;

        beforeEach(() => {
            startTimestamp = Date.now();
            slow = new SlowFs(timeout)
            fs = new CacheFs(slow)
        });


        it('loads file faster after it has been saved', () => {
            return fs.saveFile(fileName, content)
                .then(() => fs.loadTextFile(fileName))
                .then(() => expect(Date.now() - startTimestamp).to.be.lessThan(timeout * 2));
        })

        it('loads file faster after it has been saved from outside', () => {
            const onFileCreated = new Promise((resolve, reject) => {
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
});
