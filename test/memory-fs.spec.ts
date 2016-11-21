import {assertFileSystemContract} from './implementation-suite'
import {MemoryFileSystem} from "../src";

describe('the in memory implementation', function() {
    assertFileSystemContract(() => new MemoryFileSystem(), {eventChangesPollingInterval:1, noExtraEventsGrace:10, timeout:30});
});
