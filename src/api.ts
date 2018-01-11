import {Directory, DirectoryContent, File, ShallowDirectory} from "./model";

export interface FileSystemEvent {
    type: keyof Events;
    correlation?: Correlation;
}

export interface UnexpectedErrorEvent extends FileSystemEvent {
    type: 'unexpectedError';
    stack?: string;
}

export interface FileCreatedEvent extends FileSystemEvent {
    type: 'fileCreated';
    fullPath: string;
    newContent: string;
}

export interface FileChangedEvent extends FileSystemEvent {
    type: 'fileChanged';
    fullPath: string;
    newContent: string;
}

export interface FileDeletedEvent extends FileSystemEvent {
    type: 'fileDeleted';
    fullPath: string;
}

export interface DirectoryCreatedEvent extends FileSystemEvent {
    type: 'directoryCreated';
    fullPath: string;
}

export interface DirectoryDeletedEvent extends FileSystemEvent {
    type: 'directoryDeleted';
    fullPath: string;
}

export interface Disposable {
    dispose(): void
}

export function isDisposable(fs: any): fs is Disposable {
    return !!fs && typeof fs.dispose === 'function';
}

export type ListenerFn<T> = (event: T) => any;

export type Events = {
    unexpectedError: UnexpectedErrorEvent;
    fileCreated: FileCreatedEvent;
    fileChanged: FileChangedEvent;
    fileDeleted: FileDeletedEvent;
    directoryCreated: DirectoryCreatedEvent;
    directoryDeleted: DirectoryDeletedEvent;

}
export const fileSystemEventNames: Array<keyof Events> = ['unexpectedError', 'fileCreated', 'fileChanged', 'fileDeleted', 'directoryCreated', 'directoryDeleted'];
export const fileSystemAsyncMethods: Array<keyof FileSystem> = ['saveFile', 'deleteFile', 'deleteDirectory', 'loadTextFile', 'loadDirectoryTree', 'ensureDirectory', 'loadDirectoryChildren'];

export type Correlation = string;

export interface EventEmitter {
    listeners<S extends keyof Events>(event: S, exists: boolean): Array<ListenerFn<Events[S]>> | boolean;

    listeners<S extends keyof Events>(event: S): Array<ListenerFn<Events[S]>>;

    on<S extends keyof Events>(event: S, fn: ListenerFn<Events[S]>, context?: any): this;

    addListener<S extends keyof Events>(event: S, fn: ListenerFn<Events[S]>, context?: any): this;

    once<S extends keyof Events>(event: S, fn: ListenerFn<Events[S]>, context?: any): this;

    removeListener<S extends keyof Events>(event: S, fn?: ListenerFn<Events[S]>, context?: any, once?: boolean): this;

    removeAllListeners<S extends keyof Events>(event: S): this;

    off<S extends keyof Events>(event: S, fn?: ListenerFn<Events[S]>, context?: any, once?: boolean): this;

    eventNames(): Array<keyof Events>
}


export interface FileSystem {
    readonly events: EventEmitter;
    readonly baseUrl: string;

    saveFile(fullPath: string, newContent: string): Promise<Correlation>;

    deleteFile(fullPath: string): Promise<Correlation>;

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<Correlation>;

    ensureDirectory(fullPath: string): Promise<Correlation>;

    loadTextFile(fullPath: string): Promise<string>;

    loadDirectoryTree(fullPath?: string): Promise<Directory>;

    loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]>;
}


export interface FileSystemReadSync extends FileSystem {

    loadTextFileSync(fullPath: string): string;

    loadDirectoryTreeSync(fullPath?: string): Directory;

    loadDirectoryContentSync(fullPath?: string): DirectoryContent;

    loadDirectoryChildrenSync(fullPath: string): Array<File | ShallowDirectory>;
}
