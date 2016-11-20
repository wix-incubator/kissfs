import {pathSeparator, FileSystem} from './api';
import {EventEmitter} from 'eventemitter3';

export function getPathNodes(path:string):string[]{
    return path.split(pathSeparator).filter(n => n.length !== 0);
}

export type InternalEventsEmitter = EventEmitter & FileSystem.EventEmitter;
export function makeEventsEmitter(): InternalEventsEmitter{
    return (new EventEmitter()) as any as InternalEventsEmitter;
}
