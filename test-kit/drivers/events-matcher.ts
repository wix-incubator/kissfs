import {expect} from 'chai';
import {EventEmitter} from 'eventemitter3';
import {delayedPromise, retryPromise} from '../../src/promise-utils';

export interface EventObj{
    type:string;
    [k:string]:any;
}
export namespace EventsMatcher {
    export type Options = {
        interval: number;
        noExtraEventsGrace: number;
        timeout: number;
    };
}
export class EventsMatcher{
    private events: Array<EventObj> = [];
    constructor(private options:EventsMatcher.Options){}

    track(emitter: EventEmitter, ...eventNames: Array<string>) {
        eventNames.forEach(eventName => emitter.on(eventName, (event: EventObj) => {
            expect(event.type, `type of event dispatched as ${eventName}`).to.eql(eventName);
            this.events.push(event);
        }))
    }

    async expect(events: Array<EventObj>):Promise<void>{
        const {interval, timeout} = this.options;
        if (events.length) {
            await retryPromise(() => this.checkEvents(events), {retries: 100, interval, timeout});
        } else {
            expect(this.events).to.eql([]);
        }
        
        await delayedPromise(this.options.noExtraEventsGrace);
        expect(this.events, 'no further events after matching').to.eql([]);
    }

    private async checkEvents(events: Array<EventObj>): Promise<void> {
        expect(this.events).to.containSubset(events);
        this.events = [];
    }
}
