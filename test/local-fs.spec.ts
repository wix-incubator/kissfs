import {assertFileSystemContract} from './implementation-suite'
import {waitFor} from '../test-kit/utils/wait-for'
import {EventsMatcher} from '../test-kit/utils/events-matcher';
import {FileSystem} from '../src/api';
import {LocalFileSystem} from '../src/nodejs';
import {dir} from 'tmp';
import {
    mkdirAsync,
    writeFileAsync,
    unlinkAsync,
    rmdirAsync
} from 'fs-extra-promise';
import {join} from 'path';
import {expect} from 'chai';
import * as Promise from 'bluebird';
import {EventEmitter} from 'eventemitter3';

describe(`the local filesystem implementation`, function () {
    let dirCleanup, rootPath, testPath;
    let counter = 0;
    before((done)=>{
        dir({unsafeCleanup:true},(err, path, cleanupCallback)=>{
            dirCleanup = cleanupCallback;
            rootPath = path;
            done();
        })
    });
    after(()=>{
        dirCleanup();
    });

    function getFS() {
        testPath = join(rootPath, 'fs_'+(counter++));
        return mkdirAsync(testPath).then(() => new LocalFileSystem(testPath).init());
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        interval: 50,
        noExtraEventsGrace: 150,
        timeout: 1500
    };

    assertFileSystemContract(getFS, eventMatcherOptions);

    describe(`external changes`, () => {
        const fileName = 'foo.txt';
        const dirName = 'dir';
        const content = 'content';

        let fs: FileSystem;
        let matcher: EventsMatcher;
        beforeEach(() => {
            matcher = new EventsMatcher(eventMatcherOptions)
            return getFS().then(newFs => {
                fs = newFs
                matcher.track(fs.events as any as EventEmitter,
                    'fileCreated', 'fileChanged', 'fileDeleted', 'directoryCreated', 'directoryDeleted');
            })
        });

        it(`handle dir creation and deletion`, () => {
            return mkdirAsync(`${testPath}/${dirName}`)
                .then(() => waitFor(
                    () => expect(fs.loadDirectoryTree())
                        .to.eventually.have.property('children').eql([
                            {children: [], fullPath: dirName, name: dirName, type:'dir'}
                        ])
                ))
                .then(() => matcher.expect([{type: 'directoryCreated', fullPath: dirName}]))
                .then(() => rmdirAsync(`${testPath}/${dirName}`))
                .then(() => matcher.expect([{type: 'directoryDeleted', fullPath: dirName}]))
                .then(() => waitFor(
                    () => expect(fs.loadDirectoryTree()).to.eventually.have.property('children').eql([])
                ));
        });

        it(`handle file creation and deletion`, () => {
            return writeFileAsync(`${testPath}/${fileName}`, content)
                .then(() => matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]))
                .then(() => waitFor(() => expect(fs.loadTextFile(fileName)).to.eventually.equals(content)))
                .then(() => unlinkAsync(`${testPath}/${fileName}`))
                .then(() => matcher.expect([{type: 'fileDeleted', fullPath: fileName}]))
                .then(() => waitFor(() => expect(fs.loadTextFile(fileName)).to.eventually.be.rejected))
                .then(() => matcher.expect([]))
        });

    })
});
