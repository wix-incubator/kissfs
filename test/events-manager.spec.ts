import {EventHandler, EventsManager} from "../src/events-manager";
import {EventsMatcher} from "../test-kit/drivers/events-matcher";
import {DirectoryCreatedEvent, FileDeletedEvent, fileSystemEventNames} from "../src/api";
import {delayedPromise} from "../src/promise-utils";

describe('EventsManager', () => {
    let matcher: EventsMatcher;
    let em: EventsManager;

    const event1 = {type: 'fileDeleted', fullPath: 'foo'} as FileDeletedEvent;
    const event2 = {type: 'fileDeleted', fullPath: 'bar'} as FileDeletedEvent;
    const event3 = {type: 'directoryCreated', fullPath: 'baz'} as DirectoryCreatedEvent;
    const handler = {
        types: ['fileDeleted'],
        filter: (e) => e === event1,
        apply: () => (event3 as any),
    } as EventHandler<'fileDeleted'>;

    beforeEach('setup', () => {
        em = new EventsManager();
        matcher = new EventsMatcher({retries: 15, interval: 2, timeout: 40, noExtraEventsGrace: 10});
        matcher.track(em.events, ...fileSystemEventNames);
    });

    it('emits events', async () => {
        em.emit(event1);
        await matcher.expect([event1]);
    });


    it('modifies matching events', async () => {
        em.addEventHandler(handler);
        em.emit(event1); // this will change
        em.emit(event2); // this does not match handler
        await matcher.expect([event3, event2]);
    });

    it('respects time out (assume clean-up)', async () => {
        em.addEventHandler(handler, 1);
        await delayedPromise(10);
        em.emit(event1);
        await matcher.expect([event1]);
    });


    it('removes handlers', async () => {
        em.addEventHandler(handler);
        em.removeEventHandler(handler);
        em.emit(event1);
        await matcher.expect([event1]);
    });
});
