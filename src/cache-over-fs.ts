import * as Promise from 'bluebird';
import {
    FileSystem,
    Directory,
    fileSystemMethods
} from "./api";

import {MemoryFileSystem} from "./memory-fs";
import {InternalEventsEmitter, makeEventsEmitter} from "./utils";

type CalledMethods = {
    [prop: string]: boolean
};

export class CacheOverFs implements FileSystem {
    public readonly events: InternalEventsEmitter;
    public baseUrl: string;
    private cache: FileSystem;
    public readonly fs: FileSystem;
    private calledMethods: CalledMethods;

    constructor(fs: FileSystem) {
        this.fs = fs;
        this.baseUrl = fs.baseUrl;
        this.cache = new MemoryFileSystem();
        this.events = this.cache.events as InternalEventsEmitter;

        this.calledMethods = fileSystemMethods.reduce((methods, method) => {
            methods[method] = false;
            return methods;
        }, {} as CalledMethods);
    }

    saveFile(fullPath:string, newContent:string):Promise<void> {
        return this.fs.saveFile(fullPath, newContent)
            .then(() => this.cache.saveFile(fullPath, newContent));
    }

    deleteFile(fullPath:string):Promise<void> {
        return this.fs.deleteFile(fullPath)
            .then(() => this.cache.deleteFile(fullPath));
    }

    deleteDirectory(fullPath: string, recursive: boolean = false): Promise<void> {
        return this.fs.deleteDirectory(fullPath, recursive)
            .then(() => this.cache.deleteDirectory(fullPath, recursive));
    }

    ensureDirectory(fullPath:string): Promise<void> {
        return this.fs.ensureDirectory(fullPath)
            .then(() => this.cache.ensureDirectory(fullPath));
    }

    loadTextFile(fullPath):Promise<string>{
        return this
            .getProperFs(`loadTextFile${fullPath}`)
            .loadTextFile(fullPath);
    }

    loadDirectoryTree(): Promise<Directory> {
        return this
            .getProperFs(`loadDirectoryTree`)
            .loadDirectoryTree();
    }

    private getProperFs(key?: string): FileSystem {
        if (!key) return this.fs;
        if (!this.calledMethods[key]) {
            this.calledMethods[key] = true;
            return this.fs;
        }
        return this.cache;
    }
}
