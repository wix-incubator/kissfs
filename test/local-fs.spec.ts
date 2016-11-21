import {assertFileSystemContract} from './implementation-suite'
import {LocalFileSystem} from "../src/local-fs";
import {hasFsModule} from '../test-kit';
import {dir} from 'tmp';
import {mkdirSync} from 'fs';
import {join} from 'path';

if(hasFsModule) {
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
                return new LocalFileSystem(testPath)
            }, {
                eventChangesPollingInterval: 10,
                noExtraEventsGrace: 100,
                timeout: 300
            });
    });
}
