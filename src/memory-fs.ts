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

export class MemoryFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private readonly root = new Directory('', '');
    private ignore: Array<string> = [];
    private isIgnored: (path: string) => boolean = (path: string) => false;

    constructor(public baseUrl = 'http://memory', ignore?: Array<string>) {
        this.baseUrl += '/';
        if (ignore) {
            this.isIgnored = getIsIgnored(ignore)
        };
    }

    private getPathTarget(pathArr: string[]): Directory | null {
        let current: Directory = this.root;
        while (pathArr.length) {
            const name = pathArr.shift();
            if (name && current.children) {
                const node = find(current.children, {name})
                current = isDir(node) ? node : current;
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
                        if (isDir(existingChild)) {
                            return Promise.reject(new Error(`file save error for path '${fullPath}'`));
                        } else if (isFile(existingChild)) {
                            if (existingChild.content === newContent){
                                return Promise.resolve();
                            }
                            existingChild.content = newContent
                            type = 'fileChanged';
                        } else {
                            type = 'fileCreated';
                            parent.children.push(new File(name, fullPath, newContent))
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
        if (isDir(parent) && !this.isIgnored(fullPath)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isFile(node)) {
                parent.children = parent.children.filter(({name}) => name !== node.name);
                this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath});
            } else if (isDir(node)){
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
        if (isDir(parent) && !this.isIgnored(fullPath)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isFile(node)) {
                return Promise.reject(new Error(`File is not a directory '${fullPath}'`));
            } else if(isDir(node)){
                if (!recursive && node.children.length) {
                    return Promise.reject(new Error(`Directory is not empty '${fullPath}'`));
                } else {
                    parent.children = parent.children.filter(({name}) => name !== node.name);
                    this.recursiveEmitDeletion(node)
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
            if (isDir(next)) {
                return next;
            } else if (isFile(next)) {
                return Promise.reject(new Error(`File is not a directory ${next.fullPath}`));
            } else {
                const newDir = new Directory(
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
        if (isDir(parent)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isFile(node)) {
                return Promise.resolve(node.content || '');
            } else if (isDir(node)) {
                return Promise.reject(new Error(`File is a directory ${fullPath}`));
            }
        }
        return Promise.reject(new Error(`Cannot find file ${fullPath}`));
    }

    loadDirectoryTree(): Promise<Directory> {
        return Promise.resolve(this.parseTree(this.root) as Directory);
    }

    private parseTree(treeRoot: FileSystemNode): FileSystemNode {
        const res:any = {
            name: treeRoot.name,
            type: treeRoot.type,
            fullPath: treeRoot.fullPath
        };
        if (isDir(treeRoot)) {
            res.children = treeRoot.children.map(this.parseTree, this);
        }
        return res;
    }

    private recursiveEmitDeletion(node: Directory) {
        this.events.emit('directoryDeleted', {type: 'directoryDeleted', fullPath: node.fullPath});
        node.children.forEach(child => {
            if (isDir(child)) this.recursiveEmitDeletion(child)
            this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath: child.fullPath});
        })
    }
}
