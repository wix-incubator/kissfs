import {EventEmitter} from 'eventemitter3';
import * as isGlob from 'is-glob';
import * as micromatch from 'micromatch';
import {pathSeparator, EventEmitter as FSEvents} from './api';

// utility logic for filesystem implementations

export function getPathNodes(path:string):Array<string>{
    return path.split(pathSeparator).filter(n => n.length !== 0);
}

function extendMathersWithGlob(paths:Array<string>): Array<string>{
    return paths.reduce((extended, path) => {
        extended.push(path);
        if (!isGlob(path)) {
            extended.push(`${path}/**`);
        }
        return extended;
    }, [] as Array<string>);
}

export function getIsIgnored(matchers: string[], options: Object = {dot: true}): (path: string) => boolean {
    const patterns = extendMathersWithGlob(matchers);
    return (path: string) => micromatch.any(path, patterns, options);
}

export type InternalEventsEmitter = EventEmitter & FSEvents;
export function makeEventsEmitter(): InternalEventsEmitter{
    return (new EventEmitter()) as any as InternalEventsEmitter;
}
