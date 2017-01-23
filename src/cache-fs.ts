import * as Promise from 'bluebird';
import {
    FileSystem,
    Directory,
    File,
    isDir,
    fileSystemMethods
} from "./api";

import {MemoryFileSystem} from "./memory-fs";
import {InternalEventsEmitter, makeEventsEmitter} from "./utils";

type PathInCache = {
    [prop: string]: boolean
};

type Node = Directory | File;

export class CacheFs implements FileSystem {
    public readonly events: InternalEventsEmitter;
    public baseUrl: string;
    private cache: FileSystem;
    private isTreeCached: boolean = false;
    private pathsInCache: PathInCache = {};

    constructor(public readonly fs: FileSystem) {
        this.baseUrl = fs.baseUrl;
        this.cache = new MemoryFileSystem();
        this.events = this.fs.events as InternalEventsEmitter;

        this.events.on('fileCreated', ({fullPath, newContent}) => {
            this.cache.saveFile(fullPath, newContent)
                .then(() => this.pathsInCache[fullPath] = true);
        });

        this.events.on('fileChanged', ({fullPath, newContent}) => {
            this.cache.saveFile(fullPath, newContent)
                .then(() => this.pathsInCache[fullPath] = true);
        });

        this.events.on('fileDeleted', ({fullPath}) => {
            this.cache.deleteFile(fullPath)
                .then(() => this.pathsInCache[fullPath] = true);
        });

        this.events.on('directoryCreated', ({fullPath}) => this.cache.ensureDirectory(fullPath));
        this.events.on('directoryDeleted', ({fullPath}) => this.cache.deleteDirectory(fullPath, true));
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

    loadTextFile(fullPath): Promise<string>{
        if (this.pathsInCache[fullPath]) return this.cache.loadTextFile(fullPath)
        return this.fs.loadTextFile(fullPath)
            .then(file => {
                return this.cache.saveFile(fullPath, file)
                    .then(() => this.pathsInCache[fullPath] = true)
                    .then(() => this.loadTextFile(fullPath))
            })
    }

    loadDirectoryTree(): Promise<Directory> {
        if (this.isTreeCached) return this.cache.loadDirectoryTree();
        return this.cacheTree().then(() => this.cache.loadDirectoryTree());
    }

    private cacheTree(): Promise<FileSystem> {
        return this.fs.loadDirectoryTree()
            .then(tree => this.fill(tree))
    }

    private fill(tree: Node): Promise<FileSystem> {
        if (isDir(tree)) {
            return this.cache.ensureDirectory(tree.fullPath)
                .then(() => Promise.all(tree.children.map(child => this.fill(child as Node))))
                .then(() => Promise.resolve(this.cache));
        }

        return this.cache.saveFile(tree.fullPath, '')
            .then(() => Promise.resolve(this.cache))
    }
}
