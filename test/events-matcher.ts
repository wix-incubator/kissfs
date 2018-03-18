import {expect} from 'chai';
import {EventEmitter, Events} from "../src/api";
import {delayedPromise, retryPromise} from '../src/promise-utils';

export interface EventObj {
    type: string;

    [k: string]: any;
}

export namespace EventsMatcher {
    export type Options = {
        retries: number;
        interval: number;
        noExtraEventsGrace: number;
        timeout?: number;
        alwaysExpectEmpty?: boolean;
    };
}

export class EventsMatcher {
    private events: Array<EventObj> = [];

    constructor(private options: EventsMatcher.Options) {
    }

    track(emitter: EventEmitter, ...eventNames: Array<keyof Events>) {
        eventNames.forEach(eventName => emitter.on(eventName, (event: EventObj) => {
            expect(event.type, `type of event dispatched as ${eventName}`).to.eql(eventName);
            this.events.push(event);
        }))
    }

    async expect(events: Array<EventObj>): Promise<void> {
        const {interval, timeout, retries, alwaysExpectEmpty, noExtraEventsGrace} = this.options;
        if (events.length && !alwaysExpectEmpty) {
            await retryPromise(() => this.checkEvents(events), {retries, interval, timeout});
        } else {
            expect(this.events).to.eql([]);
        }

        await delayedPromise(noExtraEventsGrace);
        expect(this.events, `no further events after matching, but found:${JSON.stringify(this.events)}`).to.eql([]);
    }

    private async checkEvents(events: Array<EventObj>): Promise<void> {
        expect(this.events, JSON.stringify(events)).to.containSubset(events);
        this.events = [];
    }
}
