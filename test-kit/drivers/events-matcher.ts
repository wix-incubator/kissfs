import {expect} from "chai";
import * as Promise from 'bluebird';
import * as retry from 'bluebird-retry';
import {EventEmitter} from 'eventemitter3';

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
            console.log('caught:', event);
            expect(event.type, `type of event dispatched as ${eventName}`).to.eql(eventName);
            this.events.push(event);
        }))
    }

    expect(...events: Array<EventObj>) {
        return retry(this.checkEvents.bind(this, events), this.options)
            .catch(e => {throw e.failure;}) // restore original error from bluebird-retry
            .delay(this.options.noExtraEventsGrace)
            .then(()=> expect(this.events, 'unexpected event after successful matching').to.be.empty);
    }

    private checkEvents(events: Array<EventObj>){
        try {
            events.forEach(e => {
                expect(this.events).to.containSubset([e]);
            });
            expect(this.events.length, 'amount of events').to.eql(events.length);
            this.events = [];
            return Promise.resolve();
        } catch(e){
            return Promise.reject(e);
        }
    }
}
