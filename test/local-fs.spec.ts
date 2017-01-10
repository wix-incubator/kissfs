import {assertFileSystemContract} from './implementation-suite'
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {FileSystem} from '../src/api';
import {LocalFileSystem} from '../src/nodejs';
import {dir} from 'tmp';
import {
    mkdirSync,
    rmdirSync,
    writeFileSync,
    unlinkSync
} from 'fs';

import {join} from 'path';
import {expect} from 'chai';
import * as Promise from 'bluebird';
import {EventEmitter} from 'eventemitter3';

describe(`the local filesystem implementation`, () => {
    let dirCleanup, rootPath, testPath;
    let counter = 0;

    before(done => {
        dir({unsafeCleanup:true}, (err, path, cleanupCallback) => {
            dirCleanup = cleanupCallback;
            rootPath = path;
            done();
        })
    });
    after(() => {
        try {
            dirCleanup();
        } catch(e) {
            console.log('cleanup error', e);
        }
    });

    function getFS() {
        testPath = join(rootPath, 'fs_'+(counter++));
        mkdirSync(testPath);
        return new LocalFileSystem(testPath).init();
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        interval: 50,
        noExtraEventsGrace: 150,
        timeout: 1500
    };

    assertFileSystemContract(getFS, eventMatcherOptions);

    describe(`external changes`, () => {
        let fs: FileSystem;
        let matcher: EventsMatcher;

        const dirName = 'dir';
        const fileName = 'foo.txt';
        const content = 'content';

        beforeEach(() => {
            matcher = new EventsMatcher(eventMatcherOptions);
            return getFS().then(newFs => {
                fs = newFs
                matcher.track(fs.events as any as EventEmitter,
                    'fileCreated', 'fileChanged', 'fileDeleted', 'directoryCreated', 'directoryDeleted');
            });
        });

        it(`handles dir creation`, () => {
            const path = join(testPath, dirName);
            mkdirSync(path);
            return expect(fs.loadDirectoryTree())
                .to.eventually.have.property('children').eql([
                    {children: [], fullPath: dirName, name: dirName, type:'dir'}
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
    });
});
