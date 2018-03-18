import {EventsMatcher} from './events-matcher';
import {
    FileSystem,
    MemoryFileSystem,
    NoFeedbackEventsFileSystem,
    NoFeedbackEventsFileSystemSync
} from '../src/universal';
import {assertFileSystemContract, assertFileSystemSyncContract, ignoredDir, ignoredFile} from './implementation-suite';

function proxy<T extends FileSystem>(Proxy: { new (fs: FileSystem): T }, externalChanges: boolean): () => Promise<T> {
    return async () => {
        const innerFs: any = new MemoryFileSystem(undefined, {ignore: [ignoredDir, ignoredFile]});
        const proxy = new Proxy(innerFs);
        if (externalChanges) {
            // create FS with the proxied events, but with actions that are applied directly on the inner FS
            const hybrid = Object.create(innerFs);
            hybrid.events = proxy.events;
            return hybrid;
        }
        return proxy;
    }
}

describe(`the no-feedback-events file system proxy`, () => {
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
        });
    });
});
