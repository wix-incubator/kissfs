import {assertFileSystemContract} from './implementation-suite'
import {MemoryFileSystem} from "../src/browser";
import * as Promise from 'bluebird';

describe('the in memory implementation', function() {
    assertFileSystemContract(() => Promise.resolve(new MemoryFileSystem()), {interval:1, noExtraEventsGrace:10, timeout:30});
});
