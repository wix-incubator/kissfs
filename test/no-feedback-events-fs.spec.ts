import {EventsMatcher} from './events-matcher';
import {
    FileSystem,
    MemoryFileSystem,
    NoFeedbackEventsFileSystem,
    NoFeedbackEventsFileSystemSync
} from '../src/universal';
import {assertFileSystemContract, assertFileSystemSyncContract, ignoredDir, ignoredFile} from './implementation-suite';
import {FileSystemReadSync} from "../src/api";
import * as sinon from 'sinon';
import { expect } from 'chai';

function proxy<T extends FileSystem>(Proxy: { new (fs: FileSystemReadSync): T }, externalChanges: boolean): () => Promise<T> {
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

    describe('No feedback simple tests', function(){
        it('should not provide feed back',async ()=>{
            const memFs = new MemoryFileSystem();
            MemoryFileSystem.addContent(memFs,{
                'aFile':'gaga'
            })
            const noFeed = new NoFeedbackEventsFileSystem(memFs,{delayEvents:0,correlationWindow:100});

            const spy = sinon.spy();
            noFeed.events.on('fileChanged',spy);

            await noFeed.saveFile('aFile','baga');

            expect(spy.getCalls().length).to.equal(0);
        });
        it('should provide feedback for external',async ()=>{
            const memFs = new MemoryFileSystem();
            MemoryFileSystem.addContent(memFs,{
                'aFile':'gaga'
            })
            const noFeed = new NoFeedbackEventsFileSystem(memFs,{delayEvents:0,correlationWindow:100});

            const spy = sinon.spy();
            noFeed.events.on('fileChanged',spy);

            await memFs.saveFile('aFile','baga');

            expect(spy.getCalls().length).to.equal(1);
        });
    });


});
