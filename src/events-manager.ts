import {makeEventsEmitter} from "./utils";

import {EventEmitter, Events} from "./api";


export interface EventHandler<S extends keyof Events> {
    types: S[];
    filter: (e: Events[S]) => boolean;
    apply: (e: Events[S]) => Events[S];
}

interface RegisteredEventHandler extends EventHandler<any> {
    timer: NodeJS.Timer;
}

export class EventsManager {
    public readonly events: EventEmitter = makeEventsEmitter();
    private eventHandlers = new Set<RegisteredEventHandler>();


    emit(e: Events[keyof Events]) {
        this.eventHandlers.forEach(handler => {
            if (e && ~handler.types.indexOf(e.type) && handler.filter(e)) {
                e = handler.apply(e);
            }
        });
        if (e) {
            (this.events as any).emit(e.type, e);
        }
    }

    addEventHandler<S extends keyof Events>(handler: EventHandler<S>, timeout?: number) {
        let _handler = handler as RegisteredEventHandler;
        if (timeout) {
            (_handler).timer = setTimeout(() => this.eventHandlers.delete(_handler), timeout);
        }
        this.eventHandlers.add(_handler);
    }

    removeEventHandler<S extends keyof Events>(handler: EventHandler<S>) {
        this.eventHandlers.delete(handler as RegisteredEventHandler);
        clearTimeout((handler as RegisteredEventHandler).timer);
    }
}
