import {dir} from 'tmp';
import {mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import {content, fileName} from './implementation-suite';
import {EventsMatcher} from './events-matcher';
import {FileSystem, fileSystemEventNames, LocalFileSystem} from '../src/nodejs';
import {NoFeedbackEventsFileSystem} from '../src/no-feedback-events-fs';
import {delayedPromise} from '../src/promise-utils';
import {Events} from '../src/api';

const eventMatcherOptions: EventsMatcher.Options = {
    retries: 20,
    interval: 25,
    timeout: 1000,
    noExtraEventsGrace: 150
};

describe(`integration of the local filesystem with nofeedbackFS`, () => {
    let dirCleanup: () => void;
    let rootPath: string;
    let testPath: string;
    let counter = 0;
    let disposableFileSystem: LocalFileSystem;

    before(done => {
        dir({unsafeCleanup: true}, (_err, path, cleanupCallback) => {
            dirCleanup = cleanupCallback;
            rootPath = path;
            done();
        });
    });
    after(() => {
        try {
            dirCleanup();
        } catch (e) {
            console.log('cleanup error', e);
        }
    });
    let fs: FileSystem;
    let matcher: EventsMatcher;

    beforeEach(async () => {
        matcher = new EventsMatcher(eventMatcherOptions);
        fs = await getFS();
        matcher.track(fs.events, ...fileSystemEventNames);
    });

    afterEach(() => {
        // if beforeEach fails, disposableFileSystem can stay undefined
        disposableFileSystem && disposableFileSystem.dispose();
    });

    function getFS() {
        testPath = join(rootPath, 'fs_' + (counter++));
        mkdirSync(testPath);
        disposableFileSystem = new LocalFileSystem(testPath);
        return disposableFileSystem.init();
    }

    it('should not provide feedback when bombarding changes (stress)', async () => {
        const path = join(testPath, fileName);
        const expectedChangeEvents: Array<Events['fileChanged']> = [];
        writeFileSync(path, content);
        await matcher.expect([{type: 'fileCreated', fullPath: fileName, newContent: content}]);

        // this is a magical fix for test flakyness. let the underlying FS calm before bombarding with changes.
        await delayedPromise(100);

        const noFeed = new NoFeedbackEventsFileSystem(fs, {delayEvents: 1, correlationWindow: 10000});
        const nofeedMatcher = new EventsMatcher({
            alwaysExpectEmpty: true,
            noExtraEventsGrace: 1000,
            interval: 100,
            retries: 40,
            timeout: 1000
        });
        nofeedMatcher.track(noFeed.events, ...fileSystemEventNames);

        for (let i = 1; i < 200; i++) {
            await delayedPromise(1);
            noFeed.saveFile(fileName, 'content:' + i, '' + i);
            expectedChangeEvents.push({
                type: 'fileChanged',
                fullPath: fileName,
                newContent: 'content:' + i,
                correlation: '' + i
            });
        }
        try {
            await nofeedMatcher.expect([]);
        } catch (e) {
            console.error('nofeedMatcher failed. printing underlying events');
            try {
                await matcher.expect(expectedChangeEvents);
            } catch (e2) {
                console.error(e2);
            }
            throw e;
        }
    });
});
