import {EventEmitter} from 'eventemitter3';
import * as Promise from 'bluebird';
import {expect} from 'chai';
import * as sinon from 'sinon';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {SlowFs} from '../test-kit/drivers/slow-fs';
import {FileSystem} from '../src/api';
import {CacheFs} from '../src/cache-fs';
import {MemoryFileSystem} from '../src/memory-fs';
import {assertFileSystemContract} from './implementation-suite';

describe(`the cache file system implementation`, () => {

    assertFileSystemContract(
        () => Promise.resolve(new CacheFs(new MemoryFileSystem())),
        {
            interval: 1,
            noExtraEventsGrace: 10,
            timeout: 30
        }
    );

    describe(`using slow FileSystem`, () => {
        const fileName = 'foo.txt';
        const content = 'content';
        const timeout = 500;

        let timer;
        let fs: FileSystem;
        let slow: FileSystem;
        let startTimestamp: number;

        beforeEach(() => {
            timer = sinon.useFakeTimers();
            startTimestamp = Date.now();
            slow = new SlowFs(timer, timeout)
            fs = new CacheFs(slow)
        });

        afterEach(() => timer.restore());

        it('loads file faster after it has been saved', () => {
            fs.saveFile(fileName, content)
                .then(() => fs.loadTextFile(fileName))
                .then(() => expect(Date.now() - startTimestamp).to.be.equal(timeout))
        })

        it('loads file faster after it has been saved from outside', () => {
            fs.events.on('fileCreated', () => {
                fs.loadTextFile(fileName).then(
                    () => expect(Date.now() - startTimestamp).to.be.equal(timeout)
                )
            })
            slow.saveFile(fileName, content);
        })

        it('loads tree faster after it has been loaded before', () => {
            fs.loadDirectoryTree()
                .then(data => fs.loadDirectoryTree())
                .then(() => expect(Date.now() - startTimestamp).to.be.equal(timeout))
        })

    });
});
