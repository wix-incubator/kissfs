import {
    FileSystem,
    FileSystemNode,
    Directory,
    File,
    isDir,
    isFile,
    UnexpectedErrorEvent,
    isDisposable, ShallowDirectory
} from './api';
import {MemoryFileSystem} from './memory-fs';
import {InternalEventsEmitter, makeEventsEmitter} from './utils';
import { FileSystemReadSync } from './browser';

type PathInCache = {
    [prop: string]: boolean
};

interface FileSystemNodesMap {
    [key: string]: FileSystemNode
}

interface TreesDiff {
    toAdd: FileSystemNode[],
    toDelete: FileSystemNode[],
    toChange: string[]
}

function nodesToMap(tree: FileSystemNode[], accumulator: FileSystemNodesMap = {}): FileSystemNodesMap {
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

export class CacheFileSystem implements FileSystemReadSync, FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();

    public baseUrl: string;
    private cache: MemoryFileSystem;
    private isTreeCached: boolean = false;
    private pathsInCache: PathInCache = {};

    constructor(private fs: FileSystem , private shouldRescanOnError: boolean = true) {
        this.baseUrl = fs.baseUrl;
        this.cache = new MemoryFileSystem();

        this.fs.events.on('unexpectedError', this.onFsError);

        this.fs.events.on('fileCreated', event => {
            const {fullPath, newContent} = event;

            try {
                this.cache.saveFileSync(fullPath, newContent);
                this.pathsInCache[fullPath] = true;
                this.events.emit('fileCreated', event)
            } catch(e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('fileChanged', event => {
            const {fullPath, newContent} = event;
            try {
                this.cache.saveFileSync(fullPath, newContent);
                this.pathsInCache[fullPath] = true;
                this.events.emit('fileChanged', event);
            } catch(e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('fileDeleted', event => {
            try {
                this.cache.deleteFileSync(event.fullPath);
                this.pathsInCache[event.fullPath] = true;
                this.events.emit('fileDeleted', event);
            } catch(e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('directoryCreated', event => {
            try {
                this.cache.ensureDirectorySync(event.fullPath);
                this.events.emit('directoryCreated', event);
            } catch(e) {
                this.onFsError(e)
            }
        });

        this.fs.events.on('directoryDeleted', event => {
            try {
                this.cache.deleteDirectorySync(event.fullPath, true);
                this.events.emit('directoryDeleted', event);
            } catch(e) {
                this.onFsError(e)
            }
        });
    }

    async saveFile(fullPath:string, newContent:string): Promise<void> {
        await this.fs.saveFile(fullPath, newContent);
        this.cache.saveFileSync(fullPath, newContent);
        this.pathsInCache[fullPath] = true;
    }

    async deleteFile(fullPath:string): Promise<void> {
        await this.fs.deleteFile(fullPath);
        this.cache.deleteFileSync(fullPath);
    }

    async deleteDirectory(fullPath: string, recursive: boolean = false): Promise<void> {
        await this.fs.deleteDirectory(fullPath, recursive);
        this.cache.deleteDirectorySync(fullPath, recursive);
    }

    async ensureDirectory(fullPath:string): Promise<void> {
        await this.fs.ensureDirectory(fullPath);
        this.cache.ensureDirectorySync(fullPath);
    }

    async loadTextFile(fullPath: string): Promise<string> {
        if (this.pathsInCache[fullPath]) {
            return this.cache.loadTextFileSync(fullPath);
        }

        const file = await this.fs.loadTextFile(fullPath);
        this.cache.saveFileSync(fullPath, file);
        return this.cache.loadTextFileSync(fullPath);
    }

    loadTextFileSync(fullPath: string): string {
        return this.cache.loadTextFileSync(fullPath);
    }


    async loadDirectoryTree(fullPath?:string): Promise<Directory> {
        if (this.isTreeCached) {
            return this.cache.loadDirectoryTreeSync(fullPath);
        }

        await this.cacheTree();
        this.isTreeCached = true;
        return this.cache.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryTreeSync(fullPath:string): Directory {
        return this.cache.loadDirectoryTreeSync(fullPath);
    }


    async loadDirectoryChildren(fullPath:string): Promise<(File | ShallowDirectory)[]> {
        if (this.isTreeCached) {
            return this.cache.loadDirectoryChildrenSync(fullPath);
        }

        await this.cacheTree();
        this.isTreeCached = true;
        return this.cache.loadDirectoryChildrenSync(fullPath);
    }

    loadDirectoryChildrenSync(fullPath:string):Array<File | ShallowDirectory>{
        return this.cache.loadDirectoryChildrenSync(fullPath);
    }


    dispose() {
        if (isDisposable(this.fs)) this.fs.dispose();
    }

    private onFsError = ({stack}: Error | UnexpectedErrorEvent) => {
        this.shouldRescanOnError ?
            this.rescanOnError() :
            this.emit('unexpectedError', {stack});
    }

    private rescanOnError() {
        const cachedTree = this.cache.loadDirectoryTreeSync();
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
    }

    private emit(type: string, data: object) {
        this.events.emit(type, {...data, type});
    }

    private async cacheTree(): Promise<FileSystem> {
        this.cache = new MemoryFileSystem();
        this.pathsInCache = {};
        const tree = await this.fs.loadDirectoryTree();

        return this.fill(tree);
    }

    private async fill(tree: FileSystemNode): Promise<FileSystem> {
        if (isDir(tree)) {
            this.cache.ensureDirectorySync(tree.fullPath);
            await Promise.all(tree.children.map(child => this.fill(child)));
            return this.cache;
        }

        this.cache.saveFileSync(tree.fullPath, '');
        return this.cache;
    }
}
