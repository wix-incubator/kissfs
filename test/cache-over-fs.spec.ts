import {EventEmitter} from 'eventemitter3';
import * as Promise from 'bluebird';
import {expect} from 'chai';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {FileSystem} from '../src/api';
import {CacheOverFs} from '../src/cache-over-fs';
import {MemoryFileSystem} from '../src/memory-fs';
import {assertFileSystemContract} from './implementation-suite'

describe(`the cache over MemoryFileSystem`, () => {

    function getFS(): Promise<FileSystem> {
        return Promise.resolve(new CacheOverFs(new MemoryFileSystem()));
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        interval: 1,
        noExtraEventsGrace: 10,
        timeout: 30
    };

    assertFileSystemContract(getFS, eventMatcherOptions);
});
