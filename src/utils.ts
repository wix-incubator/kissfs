import {pathSeparator, EventEmitter as FSEvents} from './api';
import {EventEmitter} from 'eventemitter3';
import * as isGlob from 'is-glob';

// utility logic for filesystem implementations

export function getPathNodes(path:string):Array<string>{
    return path.split(pathSeparator).filter(n => n.length !== 0);
}

export function pathsToAnymatchRules(paths:Array<string>): Array<string>{
    return paths.reduce((anymatchRules, path) => {
        anymatchRules.push(path);
        if (!isGlob(path)) anymatchRules.push(`${path}/**`);
        return anymatchRules;
    }, [] as Array<string>);
}

export type InternalEventsEmitter = EventEmitter & FSEvents;
export function makeEventsEmitter(): InternalEventsEmitter{
    return (new EventEmitter()) as any as InternalEventsEmitter;
}
