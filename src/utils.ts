import {EventEmitter} from 'eventemitter3';
import * as isGlob from 'is-glob';
import * as micromatch from 'micromatch';
import {pathSeparator, EventEmitter as FSEvents} from './api';

// utility logic for filesystem implementations

export function getPathNodes(path:string):Array<string>{
    return path.split(pathSeparator).filter(n => n.length !== 0);
}

function extendMatchersWithGlob(paths:Array<string>): Array<string>{
    return paths.reduce((extended: string[], path) => {
        extended.push(path);
        if (!isGlob(path)) {
            extended.push(`${path}/**`, `**/${path}`, `**/${path}/**`);
        }
        return extended;
    }, []);
}

export function getIsIgnored(matchers: string[], options: Object = {dot: true}): (path: string) => boolean {
    const patterns = extendMatchersWithGlob(matchers);
    return (path: string) => micromatch.any(path, patterns, options);
}

export type InternalEventsEmitter = EventEmitter & FSEvents;
export function makeEventsEmitter(): InternalEventsEmitter {
    return (new EventEmitter()) as any as InternalEventsEmitter;
}
