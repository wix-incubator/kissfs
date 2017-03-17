import * as Promise from 'bluebird';
import {last, map} from 'lodash';
import {FileSystem, Directory, pathSeparator, FileSystemNode} from "./api";
import {
    InternalEventsEmitter,
    getPathNodes,
    makeEventsEmitter,
    getIsIgnored
} from "./utils";

export type FakeNode = FakeDir|FakeFile;

export class FakeDir {
    readonly type = 'dir';
    constructor(public name: string, public fullPath: string, public children: {[name: string]: FakeNode }){}
}

export class FakeFile {
    readonly type = 'file';
    constructor(public name: string, public fullPath: string, public content: string){}
}

export function isFakeDir(node : FakeNode|null): node is FakeDir{
    return node != null && node.type === 'dir';
}

export function isFakeFile(node : FakeNode|null): node is FakeFile{
    return node != null && node.type === 'file';
}

/**
 * naive in-memory implementation of the FileSystem interface
 */
export class MemoryFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    protected readonly root = new FakeDir('', '', {});
    private ignore: Array<string> = [];
    private isIgnored: (path: string) => boolean = (path: string) => false;

    constructor(public baseUrl = 'http://fake', ignore?: Array<string>) {
        this.baseUrl += '/';
        if (ignore) {
            this.isIgnored = getIsIgnored(ignore)
        };
    }

    protected getPathTarget(pathArr: string[]): FakeDir | null {
        var current: FakeDir = this.root;
        while (pathArr.length ) {
            const key = pathArr.shift();
            if (key && current.children && current.children[key] && isFakeDir(current.children[key])) {
                current = <FakeDir>current.children[key];
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
                    if(parent){
                        let type;
                        const existingChild = parent.children[name];
                        if (isFakeDir(existingChild)){
                            return Promise.reject(new Error(`file save error for path '${fullPath}'`));
                        } else if (isFakeFile(existingChild)){
                            if (existingChild.content === newContent){
                                return Promise.resolve();
                            }
                            type = 'fileChanged';
                        } else {
                            type = 'fileCreated';
                        }
                        parent.children[name] = new FakeFile(name, fullPath, newContent);
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
        const parent = (pathArr.length)? this.getPathTarget(pathArr.slice(0, pathArr.length - 1)) : null;
        if (isFakeDir(parent) && !this.isIgnored(fullPath)) {
            const node = parent.children[pathArr[pathArr.length - 1]];
            if (isFakeFile(node)) {
                delete parent.children[node.name];
                this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath});
            } else if (isFakeDir(node)){
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
        if (isFakeDir(parent) && !this.isIgnored(fullPath)) {
            const node = parent.children[pathArr[pathArr.length - 1]];
            if (isFakeFile(node)) {
                return Promise.reject(new Error(`File is not a directory '${fullPath}'`));
            } else if(node){
                if (!recursive && Object.keys(node.children).length) {
                    return Promise.reject(new Error(`Directory is not empty '${fullPath}'`));
                } else {
                    delete parent.children[node.name];
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
        return Promise.reduce(getPathNodes(fullPath), (current, dirName, _i, _l) => {
            const next = current.children[dirName];
            if (isFakeDir(next)) {
                return next;
            } else if (isFakeFile(next)) {
                return Promise.reject(new Error(`File is not a directory ${next.fullPath}`));
            } else {
                const newDir = new FakeDir(dirName, current.fullPath ? [current.fullPath, dirName].join(pathSeparator) : dirName, {});
                current.children[dirName] = newDir;
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
        if (isFakeDir(parent)) {
            const node = parent.children[pathArr[pathArr.length - 1]];
            if (isFakeFile(node)) {
                return Promise.resolve(node.content);
            } else if (isFakeDir(node)) {
                return Promise.reject(new Error(`File is a directory ${fullPath}`));
            }
        }
        return Promise.reject(new Error(`Cannot find file ${fullPath}`));
    }

    loadDirectoryTree(): Promise<Directory> {
        return Promise.resolve(this.parseTree(this.root) as Directory);
    }

    protected parseTree(treeRoot : FakeNode): FileSystemNode {
        const res:any = {
            name: treeRoot.name,
            type: treeRoot.type,
            fullPath: treeRoot.fullPath
        };
        if (isFakeDir(treeRoot)) {
            res.children = map(treeRoot.children, child => this.parseTree(child));
        }
        return res;
    }
}
