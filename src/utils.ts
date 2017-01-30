import {pathSeparator, EventEmitter as FSEvents} from './api';
import {EventEmitter} from 'eventemitter3';

// utility logic for filesystem implementations

export function getPathNodes(path:string):Array<string>{
    return path.split(pathSeparator).filter(n => n.length !== 0);
}

export function foldersListToAnymatchRules(folders:Array<string>):Array<string>{
    return folders.reduce((anymatchRules, folder) => {
        anymatchRules.push(folder);
        anymatchRules.push(`${folder}/**`);
        return anymatchRules;
    }, [] as Array<string>);
}

export type InternalEventsEmitter = EventEmitter & FSEvents;
export function makeEventsEmitter(): InternalEventsEmitter{
    return (new EventEmitter()) as any as InternalEventsEmitter;
}
