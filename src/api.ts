import * as Promise from 'bluebird';
export const pathSeparator = '/';

export interface FileSystemNode{
    name:string;
    fullPath:string;
    type:'dir'|'file';
}

export interface Directory extends FileSystemNode{
    children:Array<FileSystemNode>;
    type:'dir';
}

export function isDir(node : Directory|File): node is Directory{
    return node.type === 'dir';
}

export interface File extends FileSystemNode{
    type:'file';
}

export interface FileCreatedEvent{
    fullPath:string,
    newContent: string
}

export interface FileChangedEvent{
    fullPath:string,
    newContent: string
}

export interface FileDeletedEvent{
    fullPath:string
}

export interface DirectoryCreatedEvent{
    fullPath:string,
}

export interface DirectoryDeletedEvent{
    filename:string
}

export type ListenerFn<T> = (event: T) => void;

export interface EventAspect<S,O>{
    listeners(event: S, exists: boolean): Array<ListenerFn<O>> | boolean;
    listeners(event: S): Array<ListenerFn<O>>;
    on(event: S, fn: ListenerFn<O>, context?: any): this;
    addListener(event: S, fn: ListenerFn<O>, context?: any): this;
    once(event: S, fn: ListenerFn<O>, context?: any): this;
    removeListener(event: S, fn?: ListenerFn<O>, context?: any, once?: boolean): this;
    off(event: S, fn?: ListenerFn<O>, context?: any, once?: boolean): this;
    /** @internal */ emit(event: S, ...args: Array<any>): boolean;
}

export module FileSystem {
    export type EventEmitter =
        EventAspect<'fileCreated', FileCreatedEvent> &
        EventAspect<'fileChanged', FileChangedEvent> &
        EventAspect<'fileDeleted', FileDeletedEvent> &
        EventAspect<'directoryCreated', DirectoryCreatedEvent> &
        EventAspect<'directoryDeleted', DirectoryDeletedEvent> &
        {eventNames(): Array<'fileCreated'|'fileChanged'|'fileDeleted'|'directoryCreated'|'directoryDeleted'>};
}

export interface FileSystem {
    saveFile(filePath:string, newContent:string): Promise<void>;
    deleteFile(filename:string):Promise<void>;
    deleteDirectory(dirName:string, recursive?:boolean):Promise<void>;
    loadTextFile(filePath:string): Promise<string>;
    loadDirectoryTree(): Promise<Directory>;
    ensureDirectory(path:string): Promise<void>;
    readonly events:FileSystem.EventEmitter;
    readonly baseUrl: string;
}
