import {assertFileSystemContract, ignoredDir, ignoredFile} from './implementation-suite'
import {MemoryFileSystem} from "../src/universal";

describe('the in memory implementation', function() {
    assertFileSystemContract(
        () => Promise.resolve(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile])),
        {interval:1, noExtraEventsGrace:10, timeout:30}
    );
});
