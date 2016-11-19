import * as Promise from 'bluebird';
import {FileSystem, Directory, pathSeparator, getPathNodes, FileSystemNode} from "./types/api";
import {EventEmitter} from 'eventemitter3';
import {last, map} from 'lodash';

type FakeNode = FakeDir|FakeFile;

type RootNode = {node:FakeDir, parent:null};
type NodeAndParent = {node:FakeNode, parent:FakeDir};
type NoNodeAndParent = {node:null, parent:FakeDir};
type NoNode = {node: null, parent: null};
type FindNodeResult = RootNode|NoNode|NodeAndParent|NoNodeAndParent;

class FakeDir{
    readonly type = 'dir';
    constructor(public name: string, public fullPath: string, public children: {[name: string]: FakeNode }){}
}

class FakeFile {
    readonly type = 'file';
    constructor(public name: string, public fullPath: string, public content: string){}
}

function isFakeDir(node : FakeNode|null): node is FakeDir{
    return node != null && node.type === 'dir';
}
function isFakeFile(node : FakeNode|null): node is FakeFile{
    return node != null && node.type === 'file';
}
const dummyDir = new FakeDir('', '', {});

export class MemoryImpl implements FileSystem {
    public readonly events:EventEmitter = new EventEmitter();
    private readonly root = new FakeDir('', '', {});

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

    private findNode(path: string) : FindNodeResult{
        const pathArr = getPathNodes(path);
        const parent = this.getPathTarget(pathArr.slice(0, pathArr.length - 1));
        if (parent) {
            const parentChildren = parent.children;
            const filename = last(pathArr);
            return {node: parentChildren[filename], parent: parent};
        }
        return {node: null, parent: null};
    }

    saveFile(filename:string, newContent:string):Promise<void> {
        const pathArr = getPathNodes(filename);
        const name = pathArr.pop();
        if (name) {
            const parentPath = pathArr.join(pathSeparator);
            this.ensureDirectory(parentPath);
            const res = this.findNode(filename);
            if (isFakeDir(res.node)) {
                return Promise.reject(new Error(`file save error for path '${filename}'`));
            } else if(res.parent){
                res.parent.children[name] = new FakeFile(name, filename, newContent);
                this.events.emit('fileChanged', {filename, newContent});
                return Promise.resolve();
            } else {
                // we get here if findNode couldn't resolve the parent and the node is not the root dir.
                // this should not happen after running ensureDirectory()
                return Promise.reject(new Error(`unexpected error: not a legal file name? '${filename}'`));
            }
        } else {
            return Promise.reject(new Error(`not a legal file name '${filename}'`));
        }
    }

    deleteFile(filename:string):Promise<void> {
        const res = this.findNode(filename);
        if (isFakeFile(res.node) && isFakeDir(res.parent)) {
            delete res.parent.children[res.node.name];
            this.events.emit('fileDeleted', {filename});
        }
        return Promise.resolve();
    }

    deleteDirectory(dirName: string, recursive?: boolean): Promise<void> {
        const res = this.findNode(dirName);
        if (isFakeDir(res.node)){
            if(recursive || !Object.keys(res.node.children).length){
                if (res.parent === this.root){
                    // TODO add test
                    return Promise.reject(new Error(`Can't delete root directory`));
                } else if(res.parent){
                    delete res.parent.children[res.node.name];
                    // TODO what events do we expect?
                    // this.events.emit('fileDeleted', {filename});
                    return Promise.resolve();
                } else {
                    // node is a directory, but it's not the root and it doesn't have a parent directory
                    return Promise.reject(new Error(`unexpected: unknown Directory '${dirName}'`));
                }
            } else {
                // TODO add test
                return Promise.reject(new Error(`Directory not empty '${dirName}'`));
            }
        } else {
            // TODO add test
            return Promise.reject(new Error(`File is not a directory '${dirName}'`));
        }
    }

    ensureDirectory(dirPath:string):Promise<void> {
        let current = this.root;
        getPathNodes(dirPath).forEach(dirName => {
            let next = current.children[dirName];
            if (!next) {
                next = new FakeDir(dirName, current.fullPath ? [current.fullPath, dirName].join(pathSeparator) : dirName, {});
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
        const res = this.findNode(path);
        if(res && isFakeFile(res.node)) {
            return Promise.resolve(res.node.content);
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
