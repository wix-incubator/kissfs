import {assertFileSystemContract,assertFileSystemSyncContract, ignoredDir, ignoredFile} from './implementation-suite'
import {MemoryFileSystem} from "../src/universal";

describe('the in memory implementation', function() {
    assertFileSystemContract(
        () => Promise.resolve(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile])),
        {retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10}
    );
    assertFileSystemSyncContract(
        () => Promise.resolve(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile])),
        {retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10}
    );
});
