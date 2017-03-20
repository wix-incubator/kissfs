import * as Promise from 'bluebird';
export const pathSeparator = '/';

export interface FileSystemNode {
    type:'dir'|'file';
    name:string,
    fullPath:string,
}

export class Directory implements FileSystemNode {
    public type:'dir' = 'dir';

    constructor(
        public name:string,
        public fullPath:string,
        public children:Array<FileSystemNode> = []
    ) {}
}

export class File implements FileSystemNode {
    public type: 'file' = 'file';
    constructor(
        public name:string,
        public fullPath:string,
        public content?: string
    ) {}
}

export function isFile(node?: FileSystemNode | null): node is File{
    if (!node) return false;
    return node.type === 'file';
}

export function isDir(node?: FileSystemNode | null): node is Directory {
    if (!node) return false;
    return node.type === 'dir';
}

export interface FileCreatedEvent{
    type:'fileCreated',
    fullPath:string,
    newContent: string
}

export interface FileChangedEvent{
    type:'fileChanged',
    fullPath:string,
    newContent: string
}

export interface FileDeletedEvent{
    type:'fileDeleted',
    fullPath:string
}

export interface DirectoryCreatedEvent{
    type:'directoryCreated',
    fullPath:string,
}

export interface DirectoryDeletedEvent{
    type:'directoryDeleted',
    fullPath:string
}

export type ListenerFn<T> = (event: T) => void;

export interface EventAspect<S,O>{
    listeners(event: S, exists: boolean): Array<ListenerFn<O>> | boolean;
    listeners(event: S): Array<ListenerFn<O>>;
    on(event: S, fn: ListenerFn<O>, context?: any): this;
    addListener(event: S, fn: ListenerFn<O>, context?: any): this;
    once(event: S, fn: ListenerFn<O>, context?: any): this;
    removeListener(event: S, fn?: ListenerFn<O>, context?: any, once?: boolean): this;
    removeAllListeners(event: S): this;
    off(event: S, fn?: ListenerFn<O>, context?: any, once?: boolean): this;
}

export type FileSystemEventName = 'fileCreated' | 'fileChanged' | 'fileDeleted' | 'directoryCreated' | 'directoryDeleted';
export const fileSystemEventNames: FileSystemEventName[] = ['fileCreated', 'fileChanged', 'fileDeleted', 'directoryCreated', 'directoryDeleted'];
export type FileSystemEventHandler = FileCreatedEvent | FileChangedEvent | FileDeletedEvent | DirectoryCreatedEvent | DirectoryDeletedEvent;

export const fileSystemMethods = ['saveFile', 'deleteFile', 'deleteDirectory', 'loadTextFile', 'loadDirectoryTree', 'ensureDirectory'];

export type EventEmitter =
    EventAspect<'fileCreated', FileCreatedEvent> &
        EventAspect<'fileChanged', FileChangedEvent> &
        EventAspect<'fileDeleted', FileDeletedEvent> &
        EventAspect<'directoryCreated', DirectoryCreatedEvent> &
        EventAspect<'directoryDeleted', DirectoryDeletedEvent> &
        EventAspect<FileSystemEventName, FileSystemEventHandler> &
        {eventNames(): Array<FileSystemEventName>};

export interface FileSystem {
    saveFile(fullPath:string, newContent:string): Promise<void>;
    deleteFile(fullPath:string):Promise<void>;
    deleteDirectory(fullPath:string, recursive?:boolean):Promise<void>;
    loadTextFile(fullPath:string): Promise<string>;
    loadDirectoryTree(): Promise<Directory>;
    ensureDirectory(fullPath:string): Promise<void>;
    readonly events:EventEmitter;
    readonly baseUrl: string;
}
