import {EventEmitter} from 'eventemitter3';
import {Correlation, EventEmitter as FSEvents} from './api';
import {File, pathSeparator, ShallowDirectory} from "./model";

// utility logic for filesystem implementations

export function getPathNodes(path: string): Array<string> {
    return path.split(pathSeparator).filter(n => n.length);
}

export function normalizePathNodes(path: Array<string>): string {
    return path.filter(n => n.length).join(pathSeparator);
}

export function splitPathToDirAndFile(targetPath: string): { parentPath: string, name: string } {
    let nameParentSeparator = targetPath.lastIndexOf(pathSeparator);
    return {
        parentPath: targetPath.substr(0, nameParentSeparator),
        name: targetPath.substr(nameParentSeparator + 1)
    };
}
export function checkExistsInDir(expectedType: 'file' | 'dir', dirContent: Array<ShallowDirectory | File>, name: string) {
    for (let node of dirContent) {
        if (node.type === expectedType && node.name === name) {
            return true;
        }
    }
    return false;
}


export type InternalEventsEmitter = FSEvents & EventEmitter;

export function makeEventsEmitter(): InternalEventsEmitter {
    return (new EventEmitter()) as any as InternalEventsEmitter;
}

export function makeCorrelationId(): Correlation {
    return (Math.random().toString(36) + '0000').substr(2, 4);
}


export function endsWith(str: string, maybeSuffix: string): boolean {

    return str.lastIndexOf(maybeSuffix) === str.length - maybeSuffix.length;
}
