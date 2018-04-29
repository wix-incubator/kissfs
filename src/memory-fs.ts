import {Correlation, Events, FileSystem, FileSystemReadSync} from "./api";
import {Directory, DirectoryContent, File, isDir, isFile, pathSeparator, ShallowDirectory, SimpleStats} from "./model";

import {getPathNodes, InternalEventsEmitter, makeCorrelationId, makeEventsEmitter, normalizePathNodes} from "./utils";

let id = 0;

export namespace MemoryFileSystem {
    export interface Options {
        content?: DirectoryContent;
        model?: Directory;
    }
}

export class MemoryFileSystem implements FileSystemReadSync, FileSystem {

    static addContent(fs: MemoryFileSystem, content: DirectoryContent, path?: string) {
        const model = fs.root;
        const pathArr = path && getPathNodes(path);
        if (path && pathArr && pathArr.length) {
            fs.ensureDirectorySync(path);
            let mixin = Directory.fromContent(content, pathArr[pathArr.length - 1], normalizePathNodes(pathArr.slice(0, pathArr.length - 1)));
            Directory.mix(Directory.getSubDir(model, pathArr)!, mixin);
        } else {
            Directory.mix(model, Directory.fromContent(content));
        }
    }

    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    protected readonly root: Directory;

    constructor(public baseUrl = `memory-${id++}`, options?: MemoryFileSystem.Options) {
        this.baseUrl += '/';
        if (options) {
            if (options.model && options.content) {
                throw new Error(`MemoryFileSystem can't accept both model and content options`);
            }
            this.root = options.model || Directory.fromContent(options.content || {});
        } else {
            this.root = Directory.fromContent({});
        }
    }

    protected emit<S extends keyof Events>(type: S, event: Events[S]) {
        this.events.emit(type, event);
    }

    async saveFile(fullPath: string, newContent: string, correlation?: Correlation): Promise<Correlation> {
        return this.saveFileSync(fullPath, newContent, correlation);
    }

    async deleteFile(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        return this.deleteFileSync(fullPath, correlation);
    }

    async deleteDirectory(fullPath: string, recursive?: boolean, correlation?: Correlation): Promise<Correlation> {
        return this.deleteDirectorySync(fullPath, recursive, correlation);
    }

    async ensureDirectory(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        return this.ensureDirectorySync(fullPath, correlation);
    }

    async loadTextFile(fullPath: string): Promise<string> {
        return this.loadTextFileSync(fullPath);
    }

    async loadDirectoryTree(fullPath?: string): Promise<Directory> {
        return this.loadDirectoryTreeSync(fullPath);
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        return this.loadDirectoryChildrenSync(fullPath);
    }

    async stat(fullPath: string): Promise<SimpleStats> {
        return this.statSync(fullPath);
    }

    saveFileSync(fullPath: string, newContent: string, correlation: Correlation = makeCorrelationId()): Correlation {
        const pathArr = getPathNodes(fullPath);
        const fileName = pathArr.pop();
        if (!fileName) {
            throw new Error(`root is not a legal file name`);
        }

        this._ensureDirectorySync(pathArr.join(pathSeparator), correlation);
        const parent = Directory.getSubDir(this.root, pathArr);
        if (!parent) {
            // we get here if findNode couldn't resolve the parent and the node is not the root dir.
            // this should not happen after running ensureDirectory()
            throw new Error(`unexpected error: not a legal file name? '${fullPath}'`);
        }
        const existingChild = parent.children.find(({name}) => name === fileName);
        if (isDir(existingChild)) {
            throw new Error(`file save error for path '${fullPath}'`);
        }

        if (isFile(existingChild)) {
            if (existingChild.content !== newContent) {
                existingChild.content = newContent
                const type = 'fileChanged';
                this.emit(type, {type, fullPath, newContent, correlation});
            }
        } else {
            const type = 'fileCreated';
            parent.children.push(new File(fileName, fullPath, newContent));
            this.emit(type, {type, fullPath, newContent, correlation});
        }
        return correlation;
    }

    deleteFileSync(fullPath: string, correlation: Correlation = makeCorrelationId()): Correlation {
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? Directory.getSubDir(this.root, pathArr.slice(0, pathArr.length - 1)) : null;
        if (isDir(parent)) {
            const node = parent.children.find(({name}) => name === pathArr[pathArr.length - 1]);
            if (isFile(node)) {
                parent.children = parent.children.filter(({name}) => name !== node.name);
                this.emit('fileDeleted', {type: 'fileDeleted', fullPath, correlation});
            } else if (isDir(node)) {
                throw new Error(`Directory is not a file '${fullPath}'`);
            }
        }
        return correlation;
    }

    deleteDirectorySync(fullPath: string, recursive?: boolean, correlation: Correlation = makeCorrelationId()): Correlation {
        const pathArr = getPathNodes(fullPath);
        if (pathArr.length === 0) {
            throw new Error(`Can't delete root directory`);
        }
        const parent = Directory.getSubDir(this.root, pathArr.slice(0, pathArr.length - 1));
        if (isDir(parent)) {
            const node = parent.children.find(({name}) => name === pathArr[pathArr.length - 1]);
            if (isFile(node)) {
                throw new Error(`File is not a directory '${fullPath}'`);
            } else if (isDir(node)) {
                if (!recursive && node.children.length) {
                    throw new Error(`Directory is not empty '${fullPath}'`);
                } else {
                    parent.children = parent.children.filter(({name}) => name !== node.name);
                    this.recursiveEmitDeletion(node, correlation)
                }
            }
        }
        return correlation;
    }

    ensureDirectorySync(fullPath: string, correlation: Correlation = makeCorrelationId()): Correlation {
        return this._ensureDirectorySync(fullPath, correlation);
    }


    protected findNode(fullPath: string): Directory | File {
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? Directory.getSubDir(this.root, pathArr.slice(0, pathArr.length - 1)) : null;
        if (isDir(parent)) {
            const node = parent.children.find(({name}) => name === pathArr[pathArr.length - 1]);
            if (node) {
                return node;
            }
        }
        throw new Error(`Cannot find ${fullPath}`);
    }

    protected getDir(fullPath: string) {
        const dir = Directory.getSubDir(this.root, fullPath);
        if (!dir) {
            throw new Error(`Unable to read folder in path: '${fullPath}'`);
        }
        return dir;
    }

    loadTextFileSync(fullPath: string): string {
        const node = this.findNode(fullPath);
        if (isFile(node)) {
            return node.content || '';
        } else {
            throw new Error(`File is a directory ${fullPath}`);
        }
    }

    loadDirectoryContentSync(fullPath: string = ''): DirectoryContent {
        return Directory.toContent(this.getDir(fullPath));
    }

    loadDirectoryTreeSync(fullPath: string = ''): Directory {
        return Directory.cloneStructure(this.getDir(fullPath));
    }

    loadDirectoryChildrenSync(fullPath: string): (File | ShallowDirectory)[] {
        return this.getDir(fullPath).children.map(child => isDir(child) ? new ShallowDirectory(child.name, child.fullPath) : new File(child.name, child.fullPath));
    }

    statSync(fullPath: string): SimpleStats {
        const node = this.findNode(fullPath);
        return isFile(node) ?
            {type: 'file'} :
            {type: 'dir'};
    }

    private _ensureDirectorySync(fullPath: string, correlation: Correlation): Correlation {
        getPathNodes(fullPath).reduce((current, nodeName) => {
            const next = current.children.find(({name}) => name === nodeName);
            if (isDir(next)) {
                return next;
            }
            if (isFile(next)) {
                throw new Error(`File is not a directory ${next.fullPath}`);
            }
            const newDir = new Directory(
                nodeName,
                current.fullPath ? [current.fullPath, nodeName].join(pathSeparator) : nodeName,
            );
            current.children.push(newDir);
            this.emit('directoryCreated', {
                type: 'directoryCreated',
                fullPath: newDir.fullPath,
                correlation
            });
            return newDir;
        }, this.root);
        return correlation;
    }

    private recursiveEmitDeletion(node: Directory, correlation: Correlation) {
        this.emit('directoryDeleted', {type: 'directoryDeleted', fullPath: node.fullPath, correlation});
        node.children.forEach(child => {
            if (isDir(child)) this.recursiveEmitDeletion(child, correlation)
            this.emit('fileDeleted', {type: 'fileDeleted', fullPath: child.fullPath, correlation});
        })
    }
}
