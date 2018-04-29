import {Correlation, FileSystem, FileSystemReadSync, isDisposable, UnexpectedErrorEvent} from './api';
import {Directory, DirectoryContent, File, FileSystemNode, isDir, isFile, ShallowDirectory, SimpleStats} from "./model";

import {MemoryFileSystem} from './memory-fs';
import {getPathNodes, InternalEventsEmitter} from './utils';

enum Cached {
    FILE_FULL,
    DIR_SHALLOW,
    DIR_DEEP,
    GONE
}

type PathInCache = {
    [path: string]: undefined | Cached
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
            if (isDir(node)) nodesToMap(node.children, accumulator);
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
        shouldRescanOnError?: boolean
    }
}

export class CacheFileSystem implements FileSystemReadSync, FileSystem {

    public baseUrl: string;
    private cache: MemFsForCache = new MemFsForCache();
    public readonly events: InternalEventsEmitter = this.cache.events;
    private pathsInCache: PathInCache = {};
    private onFsError = ({stack}: Error | UnexpectedErrorEvent) => {
        this.options.shouldRescanOnError ?
            this.rescanOnError() :
            this.emit('unexpectedError', {stack});
    };

    constructor(private fs: FileSystem, private options: CacheFileSystem.Options = {}) {
        this.baseUrl = fs.baseUrl;

        this.fs.events.on('unexpectedError', this.onFsError);

        this.fs.events.on('fileCreated', event => {
            const {fullPath, newContent, correlation} = event;

            try {
                this.pathsInCache[fullPath] = Cached.FILE_FULL;
                this.cache.saveFileSync(fullPath, newContent, correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('fileChanged', event => {
            const {fullPath, newContent, correlation} = event;
            try {
                this.pathsInCache[fullPath] = Cached.FILE_FULL;
                this.cache.saveFileSync(fullPath, newContent, correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('fileDeleted', event => {
            const {fullPath, correlation} = event;
            try {
                this.pathsInCache[event.fullPath] = Cached.GONE;
                this.cache.deleteFileSync(fullPath, correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('directoryCreated', event => {
            const {fullPath, correlation} = event;
            try {
                this.cache.ensureDirectorySync(fullPath, correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('directoryDeleted', event => {
            const {fullPath, correlation} = event;
            try {
                Object.keys(this.pathsInCache).forEach(p => {
                    if (p.startsWith(fullPath)) {
                        this.pathsInCache[p] = Cached.GONE;
                    }
                });
                this.pathsInCache[fullPath] = Cached.GONE;
                this.cache.deleteDirectorySync(fullPath, true, correlation);
            } catch (e) {
                this.onFsError(e)
            }
        });
    }

    async saveFile(fullPath: string, newContent: string, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.saveFile(fullPath, newContent, correlation);
        this.pathsInCache[fullPath] = Cached.FILE_FULL;
        this.cache.saveFileSync(fullPath, newContent, correlation);
        return correlation;
    }

    async deleteFile(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.deleteFile(fullPath, correlation);
        this.pathsInCache[fullPath] = Cached.GONE;
        this.cache.deleteFileSync(fullPath);
        return correlation;
    }

    async deleteDirectory(fullPath: string, recursive: boolean = false, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.deleteDirectory(fullPath, recursive, correlation);
        this.cache.deleteDirectorySync(fullPath, recursive);
        return correlation;
    }

    async ensureDirectory(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        correlation = await this.fs.ensureDirectory(fullPath, correlation);
        this.cache.ensureDirectorySync(fullPath, correlation);
        return correlation;
    }

    async loadTextFile(fullPath: string): Promise<string> {
        if (this.pathsInCache[fullPath] === Cached.FILE_FULL || this.pathsInCache[fullPath] === Cached.GONE) {
            return this.cache.loadTextFileSync(fullPath);
        }

        const file = await this.fs.loadTextFile(fullPath);
        this.cache.saveFileSync(fullPath, file);
        return this.cache.loadTextFileSync(fullPath);
    }

    loadTextFileSync(fullPath: string): string {
        return this.cache.loadTextFileSync(fullPath);
    }

    async loadDirectoryTree(fullPath: string = ''): Promise<Directory> {
        if (this.pathsInCache[fullPath] === Cached.DIR_DEEP || this.pathsInCache[fullPath] === Cached.GONE) {
            return this.cache.loadDirectoryTreeSync(fullPath);
        }

        const realTree = await this.fs.loadDirectoryTree(fullPath);
        this.pathsInCache[fullPath] = Cached.DIR_DEEP;
        this.cache.replaceDirSync(fullPath, realTree);

        return this.cache.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryTreeSync(fullPath: string): Directory {
        return this.cache.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryContentSync(fullPath: string = ''): DirectoryContent {
        return this.cache.loadDirectoryContentSync(fullPath);
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        fullPath = fullPath || '';
        if (this.pathsInCache[fullPath] === Cached.DIR_DEEP || this.pathsInCache[fullPath] === Cached.DIR_SHALLOW || this.pathsInCache[fullPath] === Cached.GONE) {
            return this.cache.loadDirectoryChildrenSync(fullPath);
        }

        const realChildren = await this.fs.loadDirectoryChildren(fullPath);
        realChildren.forEach(c => {
            if (isDir(c)) {
                c.children = [];
            }
        });
        this.pathsInCache[fullPath] = Cached.DIR_SHALLOW;
        this.cache.replaceChildrenSync(fullPath, realChildren as (File | Directory)[]);

        return this.cache.loadDirectoryChildrenSync(fullPath);
    }

    loadDirectoryChildrenSync(fullPath: string): Array<File | ShallowDirectory> {
        return this.cache.loadDirectoryChildrenSync(fullPath);
    }

    async stat(fullPath: string): Promise<SimpleStats> {
        return this.cache.stat(fullPath);
    }

    statSync(fullPath: string): SimpleStats {
        return this.cache.statSync(fullPath);
    }

    dispose() {
        if (isDisposable(this.fs)) this.fs.dispose();
    }

    private async rescanOnError() {
        let oldPathsInCache = this.pathsInCache;
        this.pathsInCache = {};
        Object.keys(oldPathsInCache).forEach(p => {
            if (oldPathsInCache[p] === Cached.FILE_FULL) {
                this.loadTextFile(p);
            } else if (oldPathsInCache[p] === Cached.DIR_SHALLOW) {
                this.loadDirectoryChildren(p);
            } else if (oldPathsInCache[p] === Cached.DIR_DEEP) {
                this.loadDirectoryTree(p);
            }
        });
        await this.rescan('');
    }

    private async rescan(fullPath: string) {
        const realTree = await this.fs.loadDirectoryTree(fullPath);
        this.pathsInCache[fullPath] = Cached.DIR_DEEP;
        this.cache.replaceDirSync(fullPath, realTree);
    }

    private emit(type: string, data: object) {
        this.events.emit(type, {...data, type});
    }
}
