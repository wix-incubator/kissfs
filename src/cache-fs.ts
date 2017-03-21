import * as Promise from 'bluebird';
import {
    FileSystem,
    FileSystemNode,
    Directory,
    File,
    isDir,
    isFile,
    fileSystemMethods
} from './api';
import {MemoryFileSystem} from './memory-fs';
import {InternalEventsEmitter, makeEventsEmitter} from './utils';

type PathInCache = {
    [prop: string]: boolean
};

type Node = Directory | File;

interface FileSystemNodesMap {
    [key: string]: FileSystemNode
}

interface TreesDiff {
    toAdd: FileSystemNode[],
    toDelete: FileSystemNode[],
    toChange: string[]
}

function nodesToMap(tree: FileSystemNode[], accumulator = {}): FileSystemNodesMap {
    tree.forEach(node => {
        if (isDir(node)) nodesToMap(node.children, accumulator);
        accumulator[node.fullPath] = node;
    })

    return accumulator;
};

function getTreesDiff(cached: FileSystemNodesMap, real: FileSystemNodesMap): TreesDiff {
    const diff: TreesDiff = {
        toAdd: [],
        toDelete: [],
        toChange: []
    };

    Object.keys(cached).forEach(cachedPath => {
        if (!real[cachedPath]) {
            diff.toDelete.push(cached[cachedPath]);
            diff.toChange = diff.toChange.filter(path => path !== cachedPath);
        } else {
            const node = cached[cachedPath];
            if (isFile(node) && node.content) diff.toChange.push(cachedPath);
        }
    });

    Object.keys(real).forEach(realPath => {
        if (!cached[realPath]) diff.toAdd.push(real[realPath]);
    });

    return diff;
}

export class CacheFs implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();

    public baseUrl: string;
    private cache: FileSystem;
    private isTreeCached: boolean = false;
    private pathsInCache: PathInCache = {};

    constructor(private fs: FileSystem, private shouldRescanOnError: boolean = true) {
        this.baseUrl = fs.baseUrl;
        this.cache = new MemoryFileSystem();

        this.fs.events.on('unexpectedError', event => {
            this.shouldRescanOnError ?
                this.rescanOnError() :
                this.events.emit('unexpectedError', event);
        });

        this.fs.events.on('fileCreated', event => {
            const {fullPath, newContent} = event;
            this.cache.saveFile(fullPath, newContent)
                .then(() => this.pathsInCache[fullPath] = true)
                .then(() => this.events.emit('fileCreated', event));
        });

        this.fs.events.on('fileChanged', event => {
            const {fullPath, newContent} = event;
            this.cache.saveFile(fullPath, newContent)
                .then(() => this.pathsInCache[fullPath] = true)
                .then(() => this.events.emit('fileChanged', event));
        });

        this.fs.events.on('fileDeleted', event => {
            this.cache.deleteFile(event.fullPath)
                .then(() => this.pathsInCache[event.fullPath] = true)
                .then(() => this.events.emit('fileDeleted', event));
        });

        this.fs.events.on('directoryCreated', event => {
            this.cache.ensureDirectory(event.fullPath)
                .then(() => this.events.emit('directoryCreated', event));
        });

        this.fs.events.on('directoryDeleted', event => {
            this.cache.deleteDirectory(event.fullPath, true)
                .then(() => this.events.emit('directoryDeleted', event));
        });
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
            });
    }

    loadDirectoryTree(): Promise<Directory> {
        if (this.isTreeCached) return this.cache.loadDirectoryTree();
        return this.cacheTree().then(() => {
            this.isTreeCached = true;
            return this.loadDirectoryTree();
        });
    }

    private rescanOnError() {
        this.cache.loadDirectoryTree().then(cachedTree => {
            this.isTreeCached = false;
            this.loadDirectoryTree().then(realTree => {
                const {toDelete, toAdd, toChange} = getTreesDiff(
                    nodesToMap(cachedTree.children),
                    nodesToMap(realTree.children)
                );

                toDelete.forEach(node => {
                    this.emit(
                        `${isDir(node) ? 'directory' : 'file'}Deleted`,
                        {fullPath: node.fullPath}
                    );
                });

                toAdd.forEach(node => {
                    if (isDir(node)) {
                        this.emit(
                            'directoryCreated',
                            {fullPath: node.fullPath}
                        );
                    } else {
                        this.loadTextFile(node.fullPath).then(newContent => {
                            this.emit('fileCreated', {
                                fullPath: node.fullPath,
                                newContent
                            });
                        });
                    }
                });

                toChange.forEach(fullPath => this.loadTextFile(fullPath).then(newContent => {
                    this.emit('fileChanged', {fullPath, newContent});
                }))
            })
        })
    }

    private emit(type, data) {
        this.events.emit(type, {type, ...data});
    }

    private cacheTree(): Promise<FileSystem> {
        this.cache = new MemoryFileSystem();
        this.pathsInCache = {};
        return this.fs.loadDirectoryTree()
            .then(tree => this.fill(tree));
    }

    private fill(tree: Node): Promise<FileSystem> {
        if (isDir(tree)) {
            return this.cache.ensureDirectory(tree.fullPath)
                .then(() => Promise.all(tree.children.map(child => this.fill(child as Node))))
                .then(() => Promise.resolve(this.cache));
        }

        return this.cache.saveFile(tree.fullPath, '')
            .then(() => Promise.resolve(this.cache));
    }
}
