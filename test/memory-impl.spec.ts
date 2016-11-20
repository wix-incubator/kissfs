import {assertFileSystemContract} from './implementation-suite'
import {MemoryImpl} from "../src/memory-impl";

describe('the in memory implementation', function() {
    assertFileSystemContract(() => new MemoryImpl(), {eventChangesPollingInterval:1, noExtraEventsGrace:10, timeout:30});
});
