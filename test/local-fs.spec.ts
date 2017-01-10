import {assertFileSystemContract} from './implementation-suite'
import {LocalFileSystem} from "../src/nodejs";
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
            done();
        })
    });
    after(()=>{
        try {
            dirCleanup();
        } catch(e){
            console.log('cleanup error', e);
        }
    });
    assertFileSystemContract(
        () => {
            const testPath = join(rootPath, 'fs_'+(counter++));
            mkdirSync(testPath);
            return new LocalFileSystem(testPath).init();
        }, {
            interval: 50,
            noExtraEventsGrace: 150,
            timeout: 1500
        });
});
