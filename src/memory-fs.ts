import {
    FileSystem,
    Directory,
    File,
    pathSeparator,
    isDir,
    isFile, ShallowDirectory
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
    private isIgnored: (path: string) => boolean = () => false;

    constructor(public baseUrl = `memory-${id++}`, ignore?: Array<string>) {
        this.baseUrl += '/';
        if (ignore) {
            this.isIgnored = getIsIgnored(ignore)
        };
    }

    private getPathTarget(pathArr: string[]): Directory | null {
        let current: Directory = this.root;
        while (pathArr.length) {
            const targetName = pathArr.shift();
            if (targetName && current.children) {
                const node = current.children.find(({name}) => name === targetName);
                if (isDir(node)){
                    current = node;
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }
        return current;
    }

    async saveFile(fullPath: string, newContent: string): Promise<void> {
        return this.saveFileSync(fullPath, newContent);
    }

    async deleteFile(fullPath: string): Promise<void> {
        return this.deleteFileSync(fullPath);
    }

    async deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return this.deleteDirectorySync(fullPath, recursive)
    }

    async ensureDirectory(fullPath: string): Promise<void> {
        return this.ensureDirectorySync(fullPath);
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

    saveFileSync(fullPath:string, newContent:string): void {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to save ignored path: '${fullPath}'`);
        }

        const pathArr = getPathNodes(fullPath);
        const fileName = pathArr.pop();
        if (!fileName) {
            throw new Error(`root is not a legal file name`);
        }

        this.ensureDirectorySync(pathArr.join(pathSeparator));
        const parent = this.getPathTarget(pathArr);
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
                this.events.emit(type, {type, fullPath, newContent});
            }
        } else {
            const type = 'fileCreated';
            parent.children.push(new File(fileName, fullPath, newContent))
            this.events.emit(type, {type, fullPath, newContent});
        }

    }

    deleteFileSync(fullPath:string): void {
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? this.getPathTarget(pathArr.slice(0, pathArr.length - 1)) : null;
        if (isDir(parent) && !this.isIgnored(fullPath)) {
            const node = parent.children.find(({name}) => name === pathArr[pathArr.length - 1]);
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
            const node = parent.children.find(({name}) => name === pathArr[pathArr.length - 1]);
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
            current.children.push(newDir)
            this.events.emit('directoryCreated', {
                type: 'directoryCreated',
                fullPath: newDir.fullPath
            });
            return newDir;
        }, this.root)
    }

    loadTextFileSync(fullPath: string): string {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read ignored path: '${fullPath}'`);
        }
        const pathArr = getPathNodes(fullPath);
        const parent = pathArr.length ? this.getPathTarget(pathArr.slice(0, pathArr.length - 1)) : null;
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

    loadDirectoryTreeSync(fullPath:string = ''): Directory {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read ignored path: '${fullPath}'`);
        }
        const pathArr = getPathNodes(fullPath);
        const dir = pathArr.length ? this.getPathTarget(pathArr) : this.root;
        if (!dir){
            throw new Error(`Unable to read folder in path: '${fullPath}'`);
        }
        return this.parseTree(dir)
    }

    loadDirectoryChildrenSync(fullPath:string): (File | ShallowDirectory)[] {
        if (this.isIgnored(fullPath)) {
            throw new Error(`Unable to read ignored path: '${fullPath}'`);
        }
        const pathArr = getPathNodes(fullPath);
        const dir = pathArr.length ? this.getPathTarget(pathArr) : this.root;
        if (!dir){
            throw new Error(`Unable to read folder in path: '${fullPath}'`);
        }
        return dir.children.map(child => isDir(child) ? new ShallowDirectory(child.name, child.fullPath) : new File(child.name, child.fullPath));
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
