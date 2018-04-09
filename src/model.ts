import {endsWith, getPathNodes, normalizePathNodes} from "./utils";

export const pathSeparator = '/';


export type DirectoryContent = { [key: string]: string | DirectoryContent }

export interface SimpleStats {
    type: 'dir' | 'file';
}

export interface FileSystemNode extends SimpleStats {
    name: string,
    fullPath: string,
}

export class ShallowDirectory implements FileSystemNode {
    public type: 'dir' = 'dir';

    constructor(public name: string,
                public fullPath: string) {
    }
}

export class Directory implements FileSystemNode {
    public type: 'dir' = 'dir';

    constructor(public name: string,
                public fullPath: string,
                public children: Array<File | Directory> = []) {
    }

    static getSubDir(directory: Directory, path: string | string[]): Directory | null {
        const pathArr = typeof path === 'string' ? getPathNodes(path) : path;
        while (pathArr.length) {
            const targetName = pathArr.shift();
            if (targetName && directory.children) {
                const node = directory.children.find(({name}) => name === targetName);
                if (isDir(node)) {
                    directory = node;
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }
        return directory;
    }

    static clone(node: Directory, path: string | string[] = []): Directory {
        const pathArr = typeof path === 'string' ? getPathNodes(path) : path;
        if (!pathArr.length && node.name) {
            pathArr.push(node.name);
        }
        return new Directory(
            pathArr.length ? pathArr[pathArr.length - 1] : node.name,
            normalizePathNodes(pathArr),
            node.children.map(child => {
                let childPath = pathArr.concat([child.name]);
                if (isDir(child)) {
                    return this.clone(child, childPath);
                } else {
                    return new File(child.name, normalizePathNodes(childPath), child.content);
                }
            })
        )
    }

    static cloneStructure(node: Directory): Directory {
        return new Directory(
            node.name,
            node.fullPath,
            node.children.map(child => isDir(child) ? this.cloneStructure(child) : new File(child.name, child.fullPath))
        )
    }

    static fromContent(content: DirectoryContent, name: string = '', location: string = ''): Directory {

        if (location === pathSeparator) {
            location = '';
        } else if (location.length && !endsWith(location, pathSeparator)) {
            location = location + pathSeparator;
        }
        let path = location.length ? location + name : name;
        let childLocation = path.length ? path + pathSeparator : name;
        return new Directory(name, path,
            Object.keys(content).map(contentPartPath => {
                const fileContent = content[contentPartPath];
                const fullPath = childLocation + contentPartPath;
                if (typeof fileContent === 'string') {
                    return new File(contentPartPath, fullPath, fileContent);
                } else {
                    return this.fromContent(fileContent, contentPartPath, childLocation);
                }
            }));
    }

    static toContent(directory: Directory): DirectoryContent {
        const result: DirectoryContent = {};
        directory.children.forEach(child => {
            if (child.type === 'file') {
                if (child.content === undefined) {
                    throw new Error('file not loaded : ' + child.fullPath);
                }
                result[child.name] = child.content;
            } else if (child.type === 'dir') {
                result[child.name] = this.toContent(child);
            }
        });
        return result;
    }

    /**
     * add one directory to another, in-place
     * @returns {Directory} subject argument
     */
    static mix(subject: Directory, mixin: Directory): Directory {
        mixin.children.forEach(mixChild => {
            const subjChild = subject.children.find(({name}) => name === mixChild.name);
            if (isFile(mixChild)) {
                if (mixChild.content === undefined) {
                    throw new Error('file not loaded : ' + mixChild.fullPath);
                }
                if (subjChild) {
                    if (isFile(subjChild)) {
                        subjChild.content = mixChild.content;
                    } else if (isDir(subjChild)) {
                        throw new Error(`can't override directory with file : ${mixChild.fullPath} , ${subjChild.fullPath}`);
                    }
                } else {
                    subject.children.push(new File(mixChild.name, normalizePathNodes([subject.fullPath, mixChild.name]), mixChild.content));
                }
            } else if (isDir(mixChild)) {
                if (subjChild) {
                    if (isFile(subjChild)) {
                        throw new Error(`can't file directory with directory : ${mixChild.fullPath} , ${subjChild.fullPath}`);
                    } else if (isDir(subjChild)) {
                        this.mix(subjChild, mixChild);
                    }
                } else {
                    subject.children.push(Directory.clone(mixChild, [subject.fullPath, mixChild.name]));
                }
            }
        });

        return subject;
    }
}

export class File implements FileSystemNode {
    public type: 'file' = 'file';
    public content?: string;

    constructor(public name: string,
                public fullPath: string,
                content?: string) {
        if (content) this.content = content;
    }
}

export function isFile(node?: FileSystemNode | null): node is File {
    if (!node) return false;
    return node.type === 'file';
}

export function isDir(node?: FileSystemNode | null): node is Directory {
    if (!node) return false;
    return node.type === 'dir';
}
