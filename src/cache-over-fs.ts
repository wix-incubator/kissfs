import * as Promise from 'bluebird';
import {FileSystem, Directory} from "./api";
import {MemoryFileSystem} from "./memory-fs";
import {InternalEventsEmitter, makeEventsEmitter} from "./utils";

export default class CacheOverFs implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    public baseUrl: string;
    private cache: FileSystem;
    private fs: FileSystem;

    constructor(fs: FileSystem) {
        this.fs = fs;
        this.cache = new MemoryFileSystem();
        this.baseUrl = fs.baseUrl;
    }

    saveFile(fullPath:string, newContent:string):Promise<void> {
        return Promise.resolve();
    }

    deleteFile(fullPath:string):Promise<void> {
        return Promise.resolve();
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return Promise.resolve();
    }

    ensureDirectory(fullPath:string):Promise<void> {
        return Promise.resolve();
    }

    loadTextFile(fullPath):Promise<string>{
        return Promise.resolve('');
    }

    loadDirectoryTree (): Promise<Directory> {
        return Promise.resolve({} as Directory);
    }
}
