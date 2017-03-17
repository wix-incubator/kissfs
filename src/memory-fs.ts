import * as Promise from 'bluebird';
import {last, map, find} from 'lodash';
import {
    FileSystem,
    Directory,
    File,
    pathSeparator,
    FileSystemNode,
    isDir,
    isFile
} from "./api";

import {
    InternalEventsEmitter,
    getPathNodes,
    makeEventsEmitter,
    getIsIgnored
} from "./utils";


export class MemoryFile implements File {
    public readonly type = 'file';
    constructor(
        public readonly name: string,
        public readonly fullPath: string,
        public content: string = ''
    ) {}
}

export class MemoryDir implements Directory {
    public readonly type = 'dir';
    constructor(
        public readonly name: string,
        public readonly fullPath: string,
        public children: Array<MemoryNode> = []
    ) {}
}

export type MemoryNode = MemoryDir | MemoryFile;

export function isMemoryFile(node?: MemoryNode | null): node is MemoryFile{
    if (!node) return false;
    return isFile(node) && typeof node.content === 'string';
}

export function isMemoryDir(node?: MemoryNode | null): node is MemoryDir{
    if (!node) return false;
    return isDir(node);
}

export class MemoryFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    protected readonly root = new MemoryDir('', '');
    private ignore: Array<string> = [];
    private isIgnored: (path: string) => boolean = (path: string) => false;

    constructor(public baseUrl = 'http://memory', ignore?: Array<string>) {
        this.baseUrl += '/';
        if (ignore) {
            this.isIgnored = getIsIgnored(ignore)
        };
    }

    private getPathTarget(pathArr: string[]): MemoryDir | null {
        var current: MemoryDir = this.root;
        while (pathArr.length) {
            const name = pathArr.shift();
            if (name && current.children) {
                const node = find(current.children, {name})
                current = isMemoryDir(node) ? node : current;
            } else {
                return null;
            }
        }
        return current;
    }

    saveFile(fullPath:string, newContent:string):Promise<void> {
        if (this.isIgnored(fullPath)) {
            return Promise.reject(new Error(`Unable to save ignored path: '${fullPath}'`));
        }

        const pathArr = getPathNodes(fullPath);
        const name = pathArr.pop();
        if (name) {
            const parentPath = pathArr.join(pathSeparator);
            return this.ensureDirectory(parentPath)
                .then(()=> {
                    const parent = this.getPathTarget(pathArr);
                    if (parent) {
                        let type;
                        const existingChild = find(parent.children, {name});
                        if (isMemoryDir(existingChild)) {
                            return Promise.reject(new Error(`file save error for path '${fullPath}'`));
                        } else if (isMemoryFile(existingChild)) {
                            if (existingChild.content === newContent){
                                return Promise.resolve();
                            }
                            type = 'fileChanged';
                            parent.children = parent.children.map(
                                file => file.name === name ? new MemoryFile(name, fullPath, newContent) : file
                            );
                        } else {
                            type = 'fileCreated';
                            parent.children.push(new MemoryFile(name, fullPath, newContent))
                        }

                        this.events.emit(type, {type, fullPath, newContent});
                        return Promise.resolve();
                    } else {
                        // we get here if findNode couldn't resolve the parent and the node is not the root dir.
                        // this should not happen after running ensureDirectory()
                        return Promise.reject(new Error(`unexpected error: not a legal file name? '${fullPath}'`));
                    }
                });
        } else {
            return Promise.reject(new Error(`root is not a legal file name`));
        }
    }

    deleteFile(fullPath:string):Promise<void> {
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? this.getPathTarget(pathArr.slice(0, pathArr.length - 1)) : null;
        if (isMemoryDir(parent) && !this.isIgnored(fullPath)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isMemoryFile(node)) {
                parent.children = parent.children.filter(({name}) => name !== node.name);
                this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath});
            } else if (isMemoryDir(node)){
                return Promise.reject(new Error(`Directory is not a file '${fullPath}'`));
            }
        }
        return Promise.resolve();
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        const pathArr = getPathNodes(fullPath);
        if (pathArr.length === 0){
            return Promise.reject(new Error(`Can't delete root directory`));
        }
        const parent = this.getPathTarget(pathArr.slice(0, pathArr.length - 1));
        if (isMemoryDir(parent) && !this.isIgnored(fullPath)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isMemoryFile(node)) {
                return Promise.reject(new Error(`File is not a directory '${fullPath}'`));
            } else if(isMemoryDir(node)){
                if (!recursive && node.children.length) {
                    return Promise.reject(new Error(`Directory is not empty '${fullPath}'`));
                } else {
                    parent.children = parent.children.filter(({name}) => name !== node.name);
                    this.events.emit('directoryDeleted', {type: 'directoryDeleted', fullPath});
                }
            }
        }
        return Promise.resolve();
    }

    ensureDirectory(fullPath:string):Promise<void> {
        if (this.isIgnored(fullPath)) {
            return Promise.reject(new Error(`Unable to read and write ignored path: '${fullPath}'`));
        }
        return Promise.reduce(getPathNodes(fullPath), (current, name) => {
            const next = find(current.children, {name});
            if (isMemoryDir(next)) {
                return next;
            } else if (isMemoryFile(next)) {
                return Promise.reject(new Error(`File is not a directory ${next.fullPath}`));
            } else {
                const newDir = new MemoryDir(
                    name,
                    current.fullPath ? [current.fullPath, name].join(pathSeparator) : name,
                );
                current.children.push(newDir)
                this.events.emit('directoryCreated', {type:'directoryCreated', fullPath:newDir.fullPath});
                return newDir;
            }
        }, this.root).return();
    }

    loadTextFile(fullPath): Promise<string> {
        if (this.isIgnored(fullPath)) {
            return Promise.reject(new Error(`Unable to read ignored path: '${fullPath}'`));
        }
        const pathArr = getPathNodes(fullPath);
        const parent = (pathArr.length) ? this.getPathTarget(pathArr.slice(0, pathArr.length - 1)) : null;
        if (isMemoryDir(parent)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isMemoryFile(node)) {
                return Promise.resolve(node.content);
            } else if (isMemoryDir(node)) {
                return Promise.reject(new Error(`File is a directory ${fullPath}`));
            }
        }
        return Promise.reject(new Error(`Cannot find file ${fullPath}`));
    }

    loadDirectoryTree(): Promise<Directory> {
        return Promise.resolve(this.parseTree(this.root) as Directory);
    }

    private parseTree(treeRoot: MemoryNode): MemoryNode {
        const res:any = {
            name: treeRoot.name,
            type: treeRoot.type,
            fullPath: treeRoot.fullPath
        };
        if (isMemoryDir(treeRoot)) {
            res.children = treeRoot.children.map(this.parseTree, this);
        }
        return res;
    }
}
