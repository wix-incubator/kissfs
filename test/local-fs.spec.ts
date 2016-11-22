import {assertFileSystemContract} from './implementation-suite'
import {LocalFileSystem} from "../src/local-fs";
import {dir} from 'tmp';
import {mkdirSync} from 'fs';
import {join} from 'path';

describe('the local filesystem implementation', function () {
    let dirCleanup, rootPath;
    let counter = 0;
    before((done)=>{
        dir({unsafeCleanup:true},(err, path, cleanupCallback)=>{
            dirCleanup = cleanupCallback;
            rootPath = path;
            console.log(rootPath);
            done();
        })
    });
    after(()=>{
        dirCleanup();
    });
    assertFileSystemContract(
        () => {
            const testPath = join(rootPath, 'fs_'+(counter++));
            mkdirSync(testPath);
            return new LocalFileSystem(testPath).init();
        }, {
            interval: 50,
            noExtraEventsGrace: 150,
            timeout: 250
        });
});
