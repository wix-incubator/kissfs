import * as Promise from 'bluebird';
import {FileSystem, Directory, pathSeparator, getPathNodes, FileSystemNode} from "./types/api";
import {EventEmitter} from 'eventemitter3';
import {last, map} from 'lodash';

type FakeNode = FakeDir|FakeFile;
interface FakeDir{
    name: string;
    type: 'dir';
    fullPath: string;
    children: {[name: string]: FakeNode };
}
interface FakeFile {
    name: string;
    type: 'file';
    fullPath: string;
    content: string;
}

function isFakeDir(node : FakeNode): node is FakeDir{
    return node && node.type === 'dir';
}

export class MemoryImpl implements FileSystem {
    public readonly events:EventEmitter = new EventEmitter();
    private readonly root: FakeDir = {
        name: '',
        type: 'dir',
        fullPath: '',
        children: {}
    };

    constructor(public baseUrl = 'http://fake') {
        this.baseUrl += '/';
    }

    private getPathTarget(pathArr: string[]): FakeDir | null {
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

    private getDirAndName(path: string) : {name:string, file: FakeFile, parent:FakeDir} | null{
        const pathArr = getPathNodes(path);
        const parent = this.getPathTarget(pathArr.slice(0, pathArr.length - 1));
        if (parent) {
            const parentChildren = parent.children;
            const filename = last(pathArr);
            const file = parentChildren[filename];
            if (isFakeDir(file)) {
                return null;
            } else {
                return {
                    name: filename,
                    file: <FakeFile>file,
                    parent: parent
                }
            }
        } else {
            return null;
        }
    }

    saveFile(filename:string, source:string):Promise<void> {
        const pathArr = getPathNodes(filename);
        const parentPath = pathArr.slice(0, pathArr.length - 1).join(pathSeparator);
        this.ensureDirectory(parentPath);
        const res = this.getDirAndName(filename);
        if (!res) {
            throw new Error(`file creation error for path '${filename}'`);
        }

        res.parent.children[res.name] = {
            name: res.name,
            type: 'file',
            fullPath: filename,
            content: source
        };
        this.events.emit('fileChanged', {filename, source});
        return Promise.resolve();
    }

    deleteFile(filename):Promise<void> {
        this.events.emit('fileDeleted', {filename});
        return Promise.resolve();
    }

    ensureDirectory(dirPath:string):Promise<void> {
        let current = this.root;
        getPathNodes(dirPath).forEach(dirName => {
            let next = current.children[dirName];
            if (!next) {
                next = {
                    name: dirName,
                    type: 'dir',
                    fullPath: current.fullPath ? [current.fullPath, dirName].join(pathSeparator) : dirName,
                    children: {}
                };
                current.children[dirName] = next;
            }
            if (isFakeDir(next)) {
                current = next;
            } else {
                throw new Error(next.fullPath + ' is a file');
            }
        });

        return Promise.resolve();
    }

    loadTextFile(path):Promise<string>{
        const res = this.getDirAndName(path);
        if(res) {
            return Promise.resolve(res.file.content);
        } else {
            return Promise.reject(new Error(`Cannot find file ${path}`));
        }
    }

    loadDirectoryTree (): Promise<Directory> {
        return Promise.resolve(this.parseTree(this.root) as Directory);
    }

    private parseTree(treeRoot : FakeNode): FileSystemNode {
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
