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

let id = 0;

export class MemoryFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private readonly root = new Directory('', '');
    private ignore: Array<string> = [];
    private isIgnored: (path: string) => boolean = (path: string) => false;

    constructor(public baseUrl = `memory-${id++}`, ignore?: Array<string>) {
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

    saveFile(fullPath:string, newContent:string): Promise<void> {
        return Promise.try(() => this.saveFileSync(fullPath, newContent));
    }

    deleteFile(fullPath:string): Promise<void> {
        return Promise.try(() => this.deleteFileSync(fullPath));
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return Promise.try(() => this.deleteDirectorySync(fullPath, recursive))
    }

    ensureDirectory(fullPath:string):Promise<void> {
        return Promise.try(() => this.ensureDirectorySync(fullPath));
    }

    loadTextFile(fullPath): Promise<string> {
        return Promise.try(() => this.loadTextFileSync(fullPath));
    }

    loadDirectoryTree(): Promise<Directory> {
        return Promise.resolve(this.loadDirectoryTreeSync());
    }

    saveFileSync(fullPath:string, newContent:string): void {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to save ignored path: '${fullPath}'`);
        }

        const pathArr = getPathNodes(fullPath);
        const name = pathArr.pop();
        if (!name) {
            throw new Error(`root is not a legal file name`);
        }

        this.ensureDirectorySync(pathArr.join(pathSeparator));
        const parent = this.getPathTarget(pathArr);
        if (!parent) {
            // we get here if findNode couldn't resolve the parent and the node is not the root dir.
            // this should not happen after running ensureDirectory()
            throw new Error(`unexpected error: not a legal file name? '${fullPath}'`);
        }

        let type;
        const existingChild = find(parent.children, {name});
        if (isDir(existingChild)) {
            throw new Error(`file save error for path '${fullPath}'`);
        }
        if (isFile(existingChild) && existingChild.content !== newContent) {
            existingChild.content = newContent
            type = 'fileChanged';
        } else {
            type = 'fileCreated';
            parent.children.push(new File(name, fullPath, newContent))
        }

        this.events.emit(type, {type, fullPath, newContent});
    }

    deleteFileSync(fullPath:string): void {
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? this.getPathTarget(pathArr.slice(0, pathArr.length - 1)) : null;
        if (isDir(parent) && !this.isIgnored(fullPath)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isFile(node)) {
                parent.children = parent.children.filter(({name}) => name !== node.name);
                this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath});
            } else if (isDir(node)){
                throw new Error(`Directory is not a file '${fullPath}'`);
            }
        }
    }

    deleteDirectorySync(fullPath: string, recursive?: boolean): void {
        const pathArr = getPathNodes(fullPath);
        if (pathArr.length === 0){
            throw new Error(`Can't delete root directory`);
        }
        const parent = this.getPathTarget(pathArr.slice(0, pathArr.length - 1));
        if (isDir(parent) && !this.isIgnored(fullPath)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isFile(node)) {
                throw new Error(`File is not a directory '${fullPath}'`);
            } else if(isDir(node)){
                if (!recursive && node.children.length) {
                    throw new Error(`Directory is not empty '${fullPath}'`);
                } else {
                    parent.children = parent.children.filter(({name}) => name !== node.name);
                    this.recursiveEmitDeletion(node)
                }
            }
        }
    }

    ensureDirectorySync(fullPath:string): void {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read and write ignored path: '${fullPath}'`);
        }

        getPathNodes(fullPath).reduce((current, name) => {
            const next = find(current.children, {name});
            if (isDir(next)) {
                return next;
            }
            if (isFile(next)) {
                throw new Error(`File is not a directory ${next.fullPath}`);
            }
            const newDir = new Directory(
                name,
                current.fullPath ? [current.fullPath, name].join(pathSeparator) : name,
            );
            current.children.push(newDir)
            this.events.emit('directoryCreated', {
                type: 'directoryCreated',
                fullPath: newDir.fullPath
            });
            return newDir;
        }, this.root)
    }

    loadTextFileSync(fullPath): string {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read ignored path: '${fullPath}'`);
        }
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? this.getPathTarget(pathArr.slice(0, pathArr.length - 1)) : null;
        if (isDir(parent)) {
            const node = find(parent.children, {name: last(pathArr)});
            if (isFile(node)) {
                return node.content || '';
            } else if (isDir(node)) {
                throw new Error(`File is a directory ${fullPath}`);
            }
        }
        throw new Error(`Cannot find file ${fullPath}`);
    }

    loadDirectoryTreeSync(): Directory {
        return this.parseTree(this.root)
    }

    private parseTree(node: Directory): Directory {
        return new Directory(
            node.name,
            node.fullPath,
            node.children.map(child => isDir(child) ? this.parseTree(child) : new File(child.name, child.fullPath))
        )
    }

    private recursiveEmitDeletion(node: Directory) {
        this.events.emit('directoryDeleted', {type: 'directoryDeleted', fullPath: node.fullPath});
        node.children.forEach(child => {
            if (isDir(child)) this.recursiveEmitDeletion(child)
            this.events.emit('fileDeleted', {type: 'fileDeleted', fullPath: child.fullPath});
        })
    }
}
