import {assertFileSystemContract} from './implementation-suite'
import {MemoryImpl} from "../src/memory-impl";

describe('the in memory implementation', function() {
    assertFileSystemContract(() => new MemoryImpl());
});
