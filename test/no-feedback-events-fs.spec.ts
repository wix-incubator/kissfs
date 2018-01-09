import {EventsMatcher} from '../test-kit/drivers/events-matcher';

import {MemoryFileSystem} from '../src/universal';

import {assertFileSystemContract, assertFileSystemSyncContract, ignoredDir, ignoredFile} from './implementation-suite';
import {FileSystem} from "../src/api";
import {NoFeedbackEventsFileSystem, NoFeedbackEventsFileSystemSync} from "../src/no-feedback-events-fs";


function proxy<T extends FileSystem>(Proxy: { new (fs: FileSystem): T }, externalChanges: boolean): () => Promise<T> {
    return async () => {
        const innerFs: any = new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]);
        const proxy = new Proxy(innerFs);
        if (externalChanges) {
            const hybrid = Object.create(proxy);
            hybrid.events = proxy.events;
            return hybrid;
        }
        return proxy;
    }
}

describe.only(`the no-feedback-events file system proxy`, () => {
    const eventMatcherOptions: EventsMatcher.Options = {
        retries: 15,
        interval: 2,
        timeout: 40,
        noExtraEventsGrace: 5
    };

    assertFileSystemContract(proxy(NoFeedbackEventsFileSystem, false), {
        ...eventMatcherOptions,
        alwaysExpectEmpty: true
    });

    describe(`external changes`, () => {
        assertFileSystemContract(proxy(NoFeedbackEventsFileSystem, true), eventMatcherOptions);
    });

    describe(`the synchronous proxy`, () => {
        assertFileSystemContract(proxy(NoFeedbackEventsFileSystemSync, false), {
            ...eventMatcherOptions,
            alwaysExpectEmpty: true
        });

        assertFileSystemSyncContract(proxy(NoFeedbackEventsFileSystemSync, false), {
            ...eventMatcherOptions,
            alwaysExpectEmpty: true
        });

        describe(`external changes`, () => {
            assertFileSystemContract(proxy(NoFeedbackEventsFileSystemSync, true), eventMatcherOptions);

            assertFileSystemSyncContract(proxy(NoFeedbackEventsFileSystemSync, true), eventMatcherOptions);

        });
    });
});
