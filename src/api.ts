import {Directory, DirectoryContent, File, ShallowDirectory, SimpleStats} from './model';

export interface FileSystemEvent {
    type: keyof Events;
    fullPath: string;
    correlation?: Correlation;
}

export interface UnexpectedErrorEvent extends FileSystemEvent {
    type: 'unexpectedError';
    stack?: string;
}

export interface FileCreatedEvent extends FileSystemEvent {
    type: 'fileCreated';
    newContent: string;
}

export interface FileChangedEvent extends FileSystemEvent {
    type: 'fileChanged';
    newContent: string;
}

export interface FileDeletedEvent extends FileSystemEvent {
    type: 'fileDeleted';
}

export interface DirectoryCreatedEvent extends FileSystemEvent {
    type: 'directoryCreated';
}

export interface DirectoryDeletedEvent extends FileSystemEvent {
    type: 'directoryDeleted';
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
export const fileSystemAsyncMethods: Array<keyof FileSystem> = ['saveFile', 'deleteFile', 'deleteDirectory', 'loadTextFile', 'loadDirectoryTree', 'ensureDirectory', 'loadDirectoryChildren', 'stat'];

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

    saveFile(fullPath: string, newContent: string, correlation?: Correlation): Promise<Correlation>;

    deleteFile(fullPath: string, correlation?: Correlation): Promise<Correlation>;

    deleteDirectory(fullPath: string, recursive?: boolean, correlation?: Correlation): Promise<Correlation>;

    ensureDirectory(fullPath: string, correlation?: Correlation): Promise<Correlation>;

    loadTextFile(fullPath: string): Promise<string>;

    loadDirectoryTree(fullPath?: string): Promise<Directory>;

    loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]>;

    stat(fullPath: string): Promise<SimpleStats>;
}


export interface FileSystemReadSync extends FileSystem {

    loadTextFileSync(fullPath: string): string;

    loadDirectoryTreeSync(fullPath?: string): Directory;

    loadDirectoryContentSync(fullPath?: string): DirectoryContent;

    loadDirectoryChildrenSync(fullPath: string): Array<File | ShallowDirectory>;

    statSync(fullPath: string): SimpleStats;
}

export function isFileSystemReadSync(fs: FileSystem): fs is FileSystemReadSync {
    return typeof (fs as any).loadTextFileSync === 'function' &&
        typeof (fs as any).loadDirectoryTreeSync === 'function' &&
        typeof (fs as any).loadDirectoryContentSync === 'function' &&
        typeof (fs as any).loadDirectoryChildrenSync === 'function' &&
        typeof (fs as any).statSync === 'function';
}
