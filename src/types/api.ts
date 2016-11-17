import * as Promise from 'bluebird';
import {EventEmitter} from 'eventemitter3';

export const pathSeparator = '/';
export const modulesPathName= '_node_modules';

export function getPathNodes(path:string):string[]{
	return path.split(pathSeparator).filter(n => n.length !== 0);
}

export interface FileSystemNode{
	name:string;
	fullPath:string;
	type:'dir'|'file';
}

export interface Directory extends FileSystemNode{
	children:Array<FileSystemNode>;
	type:'dir';
}

export interface File extends FileSystemNode{
	type:'file';
}

export function isDir(node : Directory|File): node is Directory{
	return node.type === 'dir';
}

export interface FileChangeEvent{
	filename:string,
	source: string
}

export interface FileDeleteEvent{
	filename:string
}

export interface FileSystem {
	saveFile(filePath:string, content:string): Promise<void>;
    deleteFile(filename):Promise<void>;
    loadTextFile(filePath:string): Promise<string>;
	loadDirectoryTree(): Promise<Directory>;
	ensureDirectory(path:string): Promise<void>;
    readonly events:EventEmitter;
    readonly baseUrl: string;
}
