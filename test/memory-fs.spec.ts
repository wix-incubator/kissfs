import * as Promise from 'bluebird';
import {expect} from 'chai';
import {assertFileSystemContract, ignoredDir, ignoredFile} from './implementation-suite'
import {MemoryFileSystem} from "../src/browser";
import {FileSystem} from '../src/api';

describe('the in memory implementation', function() {
    assertFileSystemContract(
        () => Promise.resolve(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile])),
        {interval:1, timeout:30}
    );
});
