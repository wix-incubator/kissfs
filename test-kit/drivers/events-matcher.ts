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
            expect(event.type, `type of event dispatched as ${eventName}`).to.eql(eventName);
            this.events.push(event);
        }))
    }


    private expectEvents(events: Array<EventObj>):Promise<void>{
        if (events.length) {
            return retry(this.checkEvents.bind(this, events), this.options)
                .then(()=>undefined)
                .catch(e => {
                    throw e.failure;
                });
        } else {
            expect(this.events).to.eql([]);
            return Promise.resolve();
        }
    }

    expect(events: Array<EventObj>):Promise<void>{
        return this.expectEvents(events)
                .delay(this.options.noExtraEventsGrace)
                .then(()=>{expect(this.events, 'no further events after matching').to.eql([]);});
    }

    private checkEvents(events: Array<EventObj>){
        try {
            expect(this.events).to.containSubset(events);
            this.events = [];
            return Promise.resolve();
        } catch(e){
            return Promise.reject(e);
        }
    }
}
