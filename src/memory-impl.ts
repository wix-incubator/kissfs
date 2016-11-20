import * as Promise from 'bluebird';
import {FileSystem, Directory, pathSeparator, FileSystemNode} from "./api";
import {InternalEventsEmitter, getPathNodes, makeEventsEmitter} from "./utils";
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
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
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

    // TODO make into findParent
    private findNode(path: string) : FindNodeResult{
        const pathArr = getPathNodes(path);
        if (pathArr.length) {
            const parent = this.getPathTarget(pathArr.slice(0, pathArr.length - 1));
            if (parent) {
                const parentChildren = parent.children;
                const filename = last(pathArr);
                return {node: parentChildren[filename], parent: parent};
            }
            return {node: null, parent: null};
        } else {
            return {node: this.root, parent: null};
        }
    }

    saveFile(fullPath:string, newContent:string):Promise<void> {
        const pathArr = getPathNodes(fullPath);
        const name = pathArr.pop();
        if (name) {
            const parentPath = pathArr.join(pathSeparator);
            this.ensureDirectory(parentPath);
            const res = this.findNode(fullPath);
            if(res.parent){
                let type;
                const existingChild = res.parent.children[name];
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
                res.parent.children[name] = new FakeFile(name, fullPath, newContent);
                this.events.emit(type, {type, fullPath, newContent});
                return Promise.resolve();
            } else {
                // we get here if findNode couldn't resolve the parent and the node is not the root dir.
                // this should not happen after running ensureDirectory()
                return Promise.reject(new Error(`unexpected error: not a legal file name? '${fullPath}'`));
            }
        } else {
            return Promise.reject(new Error(`not a legal file name '${fullPath}'`));
        }
    }

    deleteFile(fullPath:string):Promise<void> {
        const res = this.findNode(fullPath);
        if (isFakeFile(res.node) && isFakeDir(res.parent)) {
            delete res.parent.children[res.node.name];
            this.events.emit('fileDeleted', {type:'fileDeleted', fullPath});
        }
        return Promise.resolve();
    }

    deleteDirectory(dirName: string, recursive?: boolean): Promise<void> {
        const res = this.findNode(dirName);
        if (isFakeDir(res.node)){
            if(recursive || !Object.keys(res.node.children).length){
                if (res.node === this.root){
                    return Promise.reject(new Error(`Can't delete root directory`));
                } else if(res.parent){
                    delete res.parent.children[res.node.name];
                    // this.events.emit('fileDeleted', {filename});
                    return Promise.resolve();
                } else {
                    // node is a directory, but it's not the root and it doesn't have a parent directory
                    return Promise.reject(new Error(`unexpected: unknown Directory '${dirName}'`));
                }
            } else {
                return Promise.reject(new Error(`Directory is not empty '${dirName}'`));
            }
        } else if(isFakeFile(res.node)){
            return Promise.reject(new Error(`File is not a directory '${dirName}'`));
        } else {
            return Promise.resolve();
        }
    }

    ensureDirectory(dirPath:string):Promise<void> {
        let current = this.root;
        getPathNodes(dirPath).forEach(dirName => {
            let next = current.children[dirName];
            if (!next) {
                next = new FakeDir(dirName, current.fullPath ? [current.fullPath, dirName].join(pathSeparator) : dirName, {});
                current.children[dirName] = next;
                this.events.emit('directoryCreated', {type:'directoryCreated', fullPath:next.fullPath});
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
