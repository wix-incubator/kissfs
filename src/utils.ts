import {pathSeparator, EventEmitter as FSEvents} from './api';
import {EventEmitter} from 'eventemitter3';

// utility logic for filesystem implementations

export function getPathNodes(path:string):Array<string>{
    return path.split(pathSeparator).filter(n => n.length !== 0);
}

export type InternalEventsEmitter = EventEmitter & FSEvents;
export function makeEventsEmitter(): InternalEventsEmitter{
    return (new EventEmitter()) as any as InternalEventsEmitter;
}

export const wampRealm = 'com.kissfs.driver';
