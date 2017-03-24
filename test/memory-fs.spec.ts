import * as Promise from 'bluebird';
import {expect} from 'chai';
import {assertFileSystemContract, ignoredDir, ignoredFile} from './implementation-suite'
import {MemoryFileSystem, FileSystem} from "../src/universal";

describe('the in memory implementation', function() {
    assertFileSystemContract(
        () => Promise.resolve(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile])),
        {interval:1, noExtraEventsGrace:10, timeout:30}
    );
});
