import {assertContract} from './implementation-suite'
import {MemoryImpl} from "../src/memory-impl";

describe('the in memory implementation', function() {
    assertContract(() => new MemoryImpl(), true);
});
