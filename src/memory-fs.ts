import {Correlation, FileSystem, FileSystemReadSync,} from "./api";
import {Directory, DirectoryContent, File, isDir, isFile, pathSeparator, ShallowDirectory} from "./model";

import {
    getIsIgnored,
    getPathNodes,
    InternalEventsEmitter,
    makeCorrelationId,
    makeEventsEmitter,
    normalizePathNodes
} from "./utils";

let id = 0;

export interface MemoryFileSystemOptions {
    ignore?: Array<string>;
    content?: DirectoryContent;
    model?: Directory;
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
    private readonly root: Directory;
    private isIgnored: (path: string) => boolean = () => false;

    constructor(public baseUrl = `memory-${id++}`, options?: MemoryFileSystemOptions) {
        this.baseUrl += '/';
        if (options && options.ignore) {
            this.isIgnored = getIsIgnored(options.ignore)
        }
        if (options) {
            if (options.model && options.content) {
                throw new Error(`MemoryFileSystem can't accept both model and content options`);
            }
            this.root = options.model || Directory.fromContent(options.content || {});
        } else {
            this.root = Directory.fromContent({});
        }
    }

    async saveFile(fullPath: string, newContent: string, correlation?:Correlation): Promise<Correlation> {
        return this.saveFileSync(fullPath, newContent, correlation);
    }

    async deleteFile(fullPath: string, correlation?:Correlation): Promise<Correlation> {
        return this.deleteFileSync(fullPath, correlation);
    }

    async deleteDirectory(fullPath: string, recursive?: boolean, correlation?:Correlation): Promise<Correlation> {
        return this.deleteDirectorySync(fullPath, recursive, correlation);
    }

    async ensureDirectory(fullPath: string, correlation?:Correlation): Promise<Correlation> {
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

    saveFileSync(fullPath: string, newContent: string, correlation?:Correlation): Correlation {

        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to save ignored path: '${fullPath}'`);
        }
        correlation  = correlation || makeCorrelationId();

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
                this.events.emit(type, {type, fullPath, newContent, correlation});
            }
        } else {
            const type = 'fileCreated';
            parent.children.push(new File(fileName, fullPath, newContent));
            this.events.emit(type, {type, fullPath, newContent, correlation});
        }
        return correlation;
    }

    deleteFileSync(fullPath: string, correlation?:Correlation): Correlation {
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? Directory.getSubDir(this.root, pathArr.slice(0, pathArr.length - 1)) : null;
        correlation = correlation || makeCorrelationId();
        if (isDir(parent) && !this.isIgnored(fullPath)) {
            const node = parent.children.find(({name}) => name === pathArr[pathArr.length - 1]);
            if (isFile(node)) {
                parent.children = parent.children.filter(({name}) => name !== node.name);
                this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath, correlation});
            } else if (isDir(node)) {
                throw new Error(`Directory is not a file '${fullPath}'`);
            }
        }
        return correlation;
    }

    deleteDirectorySync(fullPath: string, recursive?: boolean, correlation?:Correlation): Correlation {
        const pathArr = getPathNodes(fullPath);
        if (pathArr.length === 0) {
            throw new Error(`Can't delete root directory`);
        }
        correlation = correlation || makeCorrelationId();

        const parent = Directory.getSubDir(this.root, pathArr.slice(0, pathArr.length - 1));
        if (isDir(parent) && !this.isIgnored(fullPath)) {
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

    ensureDirectorySync(fullPath: string, correlation?:Correlation): Correlation {
        return this._ensureDirectorySync(fullPath,  correlation || makeCorrelationId());
    }

    loadTextFileSync(fullPath: string): string {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read ignored path: '${fullPath}'`);
        }
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? Directory.getSubDir(this.root, pathArr.slice(0, pathArr.length - 1)) : null;
        if (isDir(parent)) {
            const node = parent.children.find(({name}) => name === pathArr[pathArr.length - 1]);
            if (isFile(node)) {
                return node.content || '';
            } else if (isDir(node)) {
                throw new Error(`File is a directory ${fullPath}`);
            }
        }
        throw new Error(`Cannot find file ${fullPath}`);
    }

    private getDir(fullPath: string) {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read ignored path: '${fullPath}'`);
        }
        const dir = Directory.getSubDir(this.root, fullPath);
        if (!dir) {
            throw new Error(`Unable to read folder in path: '${fullPath}'`);
        }
        return dir;
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

    private _ensureDirectorySync(fullPath: string, correlation: Correlation): Correlation {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read and write ignored path: '${fullPath}'`);
        }
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
            this.events.emit('directoryCreated', {
                type: 'directoryCreated',
                fullPath: newDir.fullPath,
                correlation
            });
            return newDir;
        }, this.root);
        return correlation;
    }

    private recursiveEmitDeletion(node: Directory, correlation: Correlation) {
        this.events.emit('directoryDeleted', {type: 'directoryDeleted', fullPath: node.fullPath, correlation});
        node.children.forEach(child => {
            if (isDir(child)) this.recursiveEmitDeletion(child, correlation)
            this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath: child.fullPath, correlation});
        })
    }
}
