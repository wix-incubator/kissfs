import * as Promise from 'bluebird';
import {expect} from 'chai';
import {FileSystem} from '../src/api';
import {assertFileSystemContract, ignoredDir, ignoredFile} from './implementation-suite'
import {SlowFs} from '../test-kit/drivers/slow-fs';
import {MemoryFileSystem} from '../src/memory-fs';
import {TimeoutFs} from '../src/timeout-fs';

describe('the timeout file system imeplementation', ()=>{
    const timeout = 200;
    const accuracyFactor = 0.9;
    assertFileSystemContract(() => 
    Promise.resolve(new TimeoutFs(timeout , new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]))), 
    {interval:1, noExtraEventsGrace:10, timeout:30});

    describe(`delayed timeout test`, () => {

         let fs: FileSystem;
         let startTimestamp: number;
         let endTimestamp: number;
         const dirName = 'dir';
         const fileName = 'foo.txt';
         const content = 'content';
         const delay = timeout*2;

         beforeEach(() => {
            startTimestamp = Date.now();
             return Promise.resolve(new TimeoutFs(timeout ,new SlowFs(delay))).then(newFs => fs = newFs);
         });  
        it(`ensureDirectory exit before delay is over`, () => {
           return expect(fs.ensureDirectory(dirName)).to.eventually.be.rejectedWith("timed out").then(()=>{
               expect(startTimestamp-Date.now()).to.be.below(delay);
           });
       });
        it(`saveFile exit before delay is over`, () => {
           return expect(fs.saveFile(`${dirName}\\${fileName}`,"#goodnessSquad")).to.eventually.be.rejectedWith("timed out").then(()=>{
               expect(startTimestamp-Date.now()).to.be.below(delay);
           });
       });
        it(`deleteFile exit before delay is over`, () => {
           return expect(fs.deleteFile(`${dirName}\\${fileName}`)).to.eventually.be.rejectedWith("timed out").then(()=>{
               expect(startTimestamp-Date.now()).to.be.below(delay);
           });
       });
        it(`deleteDirectory exit before delay is over`, () => {
           return expect(fs.deleteDirectory(dirName)).to.eventually.be.rejectedWith("timed out").then(()=>{
               expect(startTimestamp-Date.now()).to.be.below(delay);
           });
       });
        it(`loadTextFile exit before delay is over`, () => {
           return expect(fs.loadTextFile(dirName)).to.eventually.be.rejectedWith("timed out").then(()=>{
               expect(startTimestamp-Date.now()).to.be.below(delay);
           });
       });
       it(`loadDirectoryTree exit before delay is over`, () => {
           return expect(fs.loadDirectoryTree()).to.eventually.be.rejectedWith("timed out").then(()=>{
               expect(startTimestamp-Date.now()).to.be.below(delay);
           });
       });

    });
});






    // describe(`delayed methods`, () => {
    //     let fs: FileSystem;
    //     let startTimestamp: number;
    //     const dirName = 'dir';
    //     const fileName = 'foo.txt';
    //     const content = 'content';

    //     beforeEach(() => {
    //         startTimestamp = Date.now();
    //         return Promise.resolve(new SlowFs(delay)).then(newFs => fs = newFs);
    //     });

    //     it(`delay the dir creation, reading tree and deleting`, () => {
    //         return fs.ensureDirectory(dirName)
    //             .then(() => fs.loadDirectoryTree())
    //             .then(() => fs.deleteDirectory(dirName))
    //             .then(() => expect(Date.now() - startTimestamp).to.be.at.least(delay * 3 * accuracyFactor))
    //     });

    //     it(`delay the file saving, reading and deleting`, () => {
    //         return fs.saveFile(fileName, content)
    //             .then(() => fs.loadTextFile(fileName))
    //             .then(() => fs.deleteFile(fileName))
    //             .then(() => expect(Date.now() - startTimestamp).to.be.at.least(delay * 3 * accuracyFactor))
    //     });
    // });

