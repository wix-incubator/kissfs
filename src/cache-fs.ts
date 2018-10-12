import {
    Correlation, FileChangedEvent, FileCreatedEvent,
    FileSystem,
    FileSystemReadSync,
    isDisposable,
    isFileSystemReadSync,
    UnexpectedErrorEvent
} from './api';
import {Directory, DirectoryContent, File, FileSystemNode, isDir, isFile, ShallowDirectory, SimpleStats} from './model';

import {MemoryFileSystem} from './memory-fs';
import {getPathNodes, InternalEventsEmitter, splitPathToDirAndFile} from './utils';

enum CacheLevel {
    FILE_FULL,
    DIR_SHALLOW,
    DIR_DEEP,
    DIR_CONTENT,
    STATS,
    GONE
}

function isCachedFile(cached: CacheLevel | undefined) {
    return cached === CacheLevel.FILE_FULL || cached === CacheLevel.GONE;
}

function isCachedDir(cached: CacheLevel | undefined) {
    return cached === CacheLevel.DIR_CONTENT || cached === CacheLevel.DIR_DEEP || cached === CacheLevel.DIR_SHALLOW || cached === CacheLevel.GONE;
}

function isCachedDirDeep(cached: CacheLevel | undefined) {
    return cached === CacheLevel.DIR_CONTENT || cached === CacheLevel.DIR_DEEP || cached === CacheLevel.GONE;
}

function isCachedDirContent(cached: CacheLevel | undefined) {
    return cached === CacheLevel.DIR_CONTENT || cached === CacheLevel.GONE;
}

type PathInCache = {
    [path: string]: undefined | CacheLevel
};

interface FileSystemNodesMap {
    [key: string]: FileSystemNode
}

interface TreesDiff {
    toAdd: FileSystemNode[],
    toDelete: FileSystemNode[],
    toChange: string[]
}

function nodesToMap(tree: FileSystemNode[] | undefined, accumulator: FileSystemNodesMap = {}): FileSystemNodesMap {
    if (tree) {
        tree.forEach(node => {
            if (isDir(node)) {
                nodesToMap(node.children, accumulator);
            }
            accumulator[node.fullPath] = node;
        });
    }

    return accumulator;
}

function transformAndReport(oldMap: FileSystemNodesMap, newMap: FileSystemNodesMap): TreesDiff {
    const diff: TreesDiff = {
        toAdd: [],
        toDelete: [],
        toChange: []
    };

    Object.keys(oldMap).forEach(oldPath => {
        const oldNode = oldMap[oldPath];
        const newNode = newMap[oldPath];
        if (!newNode) {
            diff.toDelete.push(oldNode);
            diff.toChange = diff.toChange.filter(path => path !== oldPath);
        } else if (isFile(oldNode)) {
            if (isFile(newNode) && newNode.content === undefined) {
                newNode.content = oldNode.content;
            } else if (oldNode.content) {
                diff.toChange.push(oldPath)
            }
        }
    });

    Object.keys(newMap).forEach(newPath => {
        const oldNode = oldMap[newPath];
        const newNode = newMap[newPath];
        if (!oldNode) {
            diff.toAdd.push(newNode);
        }
    });

    return diff;
}

class MemFsForCache extends MemoryFileSystem {

    private emitDiffEvents(toDelete: FileSystemNode[], toAdd: FileSystemNode[], toChange: string[]) {
        toDelete.forEach(node => {
            let type = `${isDir(node) ? 'directory' : 'file'}Deleted` as any;
            this.events.emit(type, {type, fullPath: node.fullPath});
        });

        toAdd.forEach(node => {
            if (isDir(node)) {
                this.events.emit(
                    'directoryCreated',
                    {type: 'directoryCreated', fullPath: node.fullPath}
                );
            } else if (isFile(node)) {
                if (node.content !== undefined) {
                    this.events.emit('fileCreated', {
                        type: 'fileCreated',
                        fullPath: node.fullPath,
                        newContent: node.content
                    });
                }
            } else {
                throw new Error('unknown node type');
            }
        });

        toChange.forEach(fullPath => this.loadTextFile(fullPath).then(newContent => {
            this.events.emit('fileChanged', {type: 'fileChanged', fullPath, newContent});
        }));
    }

    replaceChildrenSync(fullPath: string, newChildren: (File | Directory)[]) {
        const cachedTree = this.getDir(fullPath);
        let newChildrenMap = nodesToMap(newChildren);
        const {toDelete, toAdd, toChange} = transformAndReport(
            nodesToMap(cachedTree.children),
            newChildrenMap
        );

        cachedTree.children = cachedTree.children.filter(c => !~toDelete.indexOf(c));
        cachedTree.children.forEach(c => {
            if (isFile(c) && ~toChange.indexOf(c.fullPath)) {
                let newChild = newChildrenMap[c.fullPath];
                if (isFile(newChild) && newChild.content !== undefined) {
                    c.content = newChild.content;
                }
            }
        });
        cachedTree.children = cachedTree.children.concat(toAdd as (File | Directory)[]);

        this.emitDiffEvents(toDelete, toAdd, toChange);
    }

    replaceDirSync(fullPath: string, newDir: Directory) {
        const cachedTree = this.getDir(fullPath);
        let newChildrenMap = nodesToMap(newDir.children);
        const {toDelete, toAdd, toChange} = transformAndReport(
            nodesToMap(cachedTree.children),
            newChildrenMap
        );

        const pathArr = getPathNodes(fullPath);
        if (pathArr.length === 0) {
            this.root.children = newDir.children;
        } else {
            const parent = Directory.getSubDir(this.root, pathArr.slice(0, pathArr.length - 1));
            if (!parent) {
                throw new Error('directory parent missing: ' + pathArr.slice(0, pathArr.length - 1).join('/'))
            } else {
                parent.children = parent.children.map((child) => child.name === newDir.name ? newDir : child);
            }
        }

        this.emitDiffEvents(toDelete, toAdd, toChange);
    }
}

export namespace CacheFileSystem {
    export interface Options {
        /**
         * should the cache re-sync when an error is reported from the underlying FS
         * default : true
         */
        reSyncOnError?: boolean;
        /**
         * should sync read methods propagate to underlying FS
         * default : false
         */
        propagateSyncRead?: boolean;
    }
}

interface HasInnerFileSystemReadSync {
    fs: FileSystemReadSync;
}

export class CacheFileSystem implements FileSystemReadSync, FileSystem {

    public baseUrl: string;
    fs: FileSystem;
    private cache: MemFsForCache = new MemFsForCache();
    public readonly events: InternalEventsEmitter = this.cache.events;
    private pathsInCache: PathInCache = {};
    private onFsError = ({stack}: Error | UnexpectedErrorEvent) => {
        this.options.reSyncOnError ?
            this.reSyncOnError() :
            this.emit('unexpectedError', {stack});
    };

    constructor(fs: FileSystem, private options: CacheFileSystem.Options = {}) {
        this.fs = fs;
        if (this.options.reSyncOnError === undefined) {
            this.options.reSyncOnError = true;
        }
        if (this.options.propagateSyncRead && !isFileSystemReadSync(fs)) {
            throw new Error('propagateSyncRead option set to true but file system is not FileSystemReadSync')
        }
        this.baseUrl = fs.baseUrl;

        this.fs.events.on('unexpectedError', this.onFsError);

        const fileChangeCreatedHandler = (event: FileChangedEvent | FileCreatedEvent) => {
            try {
                this.cacheTextFile(event.fullPath, event.newContent, event.correlation);
            } catch (e) {
                this.onFsError(e)
            }
        };
        this.fs.events.on('fileCreated', fileChangeCreatedHandler);
        this.fs.events.on('fileChanged', fileChangeCreatedHandler);
        this.fs.events.on('fileDeleted', event => {
            try {
                this.cacheFileGone(event.fullPath, event.correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('directoryCreated', event => {
            try {
                this.cacheDirectoryExists(event.fullPath, event.correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('directoryDeleted', event => {
            try {
                this.cacheDirectoryGone(true, event.fullPath, event.correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });
    }

    private isPropagateSyncRead(): this is HasInnerFileSystemReadSync {
        return this.options.propagateSyncRead || false;
    }

    private cacheTextFile(fullPath: string, newContent: string, correlation?: Correlation) {
        this.pathsInCache[fullPath] = CacheLevel.FILE_FULL;
        this.cache.saveFileSync(fullPath, newContent, correlation);
    }

    private cacheDirTree(fullPath: string, newTree: Directory) {
        this.pathsInCache[fullPath] = CacheLevel.DIR_DEEP;
        this.cache.ensureDirectorySync(fullPath);
        this.cache.replaceDirSync(fullPath, newTree);
    }

    private cacheDirChildren(fullPath: string, newChildren: (File | ShallowDirectory)[]) {
        newChildren.forEach(c => {
            if (isDir(c)) {
                c.children = [];
            }
        });
        this.pathsInCache[fullPath] = CacheLevel.DIR_SHALLOW;
        this.cache.ensureDirectorySync(fullPath);
        this.cache.replaceChildrenSync(fullPath, newChildren as (File | Directory)[]);
    }

    private cacheStat(fullPath: string, newStat: SimpleStats) {
        this.pathsInCache[fullPath] = CacheLevel.STATS;
        if (newStat.type === 'file') {
            this.cache.saveFileSync(fullPath, '');
        } else if (newStat.type === 'dir') {
            this.cache.ensureDirectorySync(fullPath);
        }
    }

    private cacheDirectoryGone(recursive: boolean, fullPath: string, correlation?: Correlation) {
        if (recursive) {
            Object.keys(this.pathsInCache).forEach(p => {
                if (p.startsWith(fullPath)) {
                    this.pathsInCache[p] = CacheLevel.GONE;
                }
            });
        } else {
            this.pathsInCache[fullPath] = CacheLevel.GONE;
        }
        this.cache.deleteDirectorySync(fullPath, recursive, correlation);
    }

    private cacheDirectoryExists(fullPath: string, correlation?: Correlation) {
        if (this.pathsInCache[fullPath] === undefined || this.pathsInCache[fullPath] === CacheLevel.GONE) {
            this.pathsInCache[fullPath] = CacheLevel.DIR_DEEP;
        }
        this.cache.ensureDirectorySync(fullPath, correlation);
    }

    private cacheFileGone(fullPath: string, correlation?: Correlation) {
        this.pathsInCache[fullPath] = CacheLevel.GONE;
        this.cache.deleteFileSync(fullPath, correlation);
    }

    async saveFile(fullPath: string, newContent: string, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.saveFile(fullPath, newContent, correlation);
        this.cacheTextFile(fullPath, newContent, correlation);
        return correlation;
    }

    async deleteFile(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.deleteFile(fullPath, correlation);
        this.cacheFileGone(fullPath, correlation);
        return correlation;
    }

    async deleteDirectory(fullPath: string, recursive: boolean = false, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.deleteDirectory(fullPath, recursive, correlation);
        this.cacheDirectoryGone(recursive, fullPath);
        return correlation;
    }

    async ensureDirectory(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.ensureDirectory(fullPath, correlation);
        this.cacheDirectoryExists(fullPath, correlation);
        return correlation;
    }

    async loadTextFile(fullPath: string): Promise<string> {
        if (!isCachedFile(this.pathsInCache[fullPath])) {
            this.cacheTextFile(fullPath, await this.fs.loadTextFile(fullPath));
        }
        return this.cache.loadTextFileSync(fullPath);
    }

    loadTextFileSync(fullPath: string): string {
        if (this.isPropagateSyncRead() && !isCachedFile(this.pathsInCache[fullPath])) {
            this.cacheTextFile(fullPath, this.fs.loadTextFileSync(fullPath));
        }
        return this.cache.loadTextFileSync(fullPath);
    }

    async loadDirectoryTree(fullPath: string = ''): Promise<Directory> {
        if (!isCachedDirDeep(this.pathsInCache[fullPath])) {
            this.cacheDirTree(fullPath, await this.fs.loadDirectoryTree(fullPath));
        }
        return this.cache.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryTreeSync(fullPath: string = ''): Directory {
        if (this.isPropagateSyncRead() && !isCachedDirDeep(this.pathsInCache[fullPath])) {
            this.cacheDirTree(fullPath, this.fs.loadDirectoryTreeSync(fullPath));
        }
        return this.cache.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryContentSync(fullPath: string = ''): DirectoryContent {
        if (this.isPropagateSyncRead() && !isCachedDirContent(this.pathsInCache[fullPath])) {
            const content = this.fs.loadDirectoryContentSync(fullPath);
            this.pathsInCache[fullPath] = CacheLevel.DIR_CONTENT;
            this.cache.ensureDirectorySync(fullPath);
            this.cache.replaceDirSync(fullPath, Directory.fromContent(content));
        }
        return this.cache.loadDirectoryContentSync(fullPath);
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        if (!isCachedDir(this.pathsInCache[fullPath])) {
            this.cacheDirChildren(fullPath, await this.fs.loadDirectoryChildren(fullPath));
        }
        return this.cache.loadDirectoryChildrenSync(fullPath);
    }

    loadDirectoryChildrenSync(fullPath: string): Array<File | ShallowDirectory> {
        if (this.isPropagateSyncRead() && !isCachedDir(this.pathsInCache[fullPath])) {
            this.cacheDirChildren(fullPath, this.fs.loadDirectoryChildrenSync(fullPath));
        }
        return this.cache.loadDirectoryChildrenSync(fullPath);
    }

    async stat(fullPath: string): Promise<SimpleStats> {
        if (this.pathsInCache[fullPath] === undefined) {
            this.cacheStat(fullPath, await this.fs.stat(fullPath));
        }
        return this.cache.stat(fullPath);
    }

    statSync(fullPath: string): SimpleStats {
        if (this.isPropagateSyncRead() && this.pathsInCache[fullPath] === undefined) {
            this.cacheStat(fullPath, this.fs.statSync(fullPath));
        }
        return this.cache.statSync(fullPath);
    }

    dispose() {
        if (isDisposable(this.fs)) this.fs.dispose();
    }

    private async reSyncOnError() {
        let oldPathsInCache = this.pathsInCache;
        this.pathsInCache = {};
        Object.keys(oldPathsInCache).forEach(p => {
            if (oldPathsInCache[p] === CacheLevel.FILE_FULL) {
                this.loadTextFile(p);
                this.loadDirectoryChildren(splitPathToDirAndFile(p).parentPath);
            } else if (oldPathsInCache[p] === CacheLevel.DIR_SHALLOW) {
                this.loadDirectoryChildren(p);
                this.loadDirectoryChildren(splitPathToDirAndFile(p).parentPath);
            } else if (oldPathsInCache[p] === CacheLevel.DIR_DEEP) {
                this.loadDirectoryTree(p);
                this.loadDirectoryChildren(splitPathToDirAndFile(p).parentPath);
            }
        });
    }

    private emit(type: string, data: object) {
        this.events.emit(type, {...data, type});
    }
}
