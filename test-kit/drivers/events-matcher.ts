import {expect} from 'chai';
import {isEmpty} from 'lodash';
import * as Promise from 'bluebird';
import * as retry from 'bluebird-retry';
import {EventEmitter} from 'eventemitter3';
import {waitIfThrow} from './waitIfThrow';

export interface EventObj{
    type:string;
    [k:string]:any;
}
export namespace EventsMatcher {
    export type Options = {
        interval: number;
        timeout: number;
        max_tries?: number;
    };
}
export class EventsMatcher {
    private events: Array<EventObj> = [];
    constructor(private options:EventsMatcher.Options){}

    track(emitter: EventEmitter, ...eventNames: Array<string>) {
        eventNames.forEach(eventName => emitter.on(eventName, (event: EventObj) => {
            expect(event.type, `type of event dispatched as ${eventName}`).to.eql(eventName);
            this.events.push(event);
        }))
    }

    expect(events: Array<EventObj>) {
        return retry(this.checkEvents.bind(this, events), this.options)
            .catch(e => {throw e.failure;}) // restore original error from bluebird-retry
            .finally(() => this.events = [])

    }

    private checkEvents(events: Array<EventObj>){
        if (isEmpty(events)) {
            return waitIfThrow(() => expect(this.events.length, `length of dispathched events to be 0`).to.eql(0))
        }
        try {
            expect(this.events).to.containSubset(events);
            return Promise.resolve();
        } catch(e){
            return Promise.reject(e);
        }
    }
}
