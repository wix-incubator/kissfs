import {FileSystem, Directory, pathSeparator, FileSystemNode} from "./api";
import {InternalEventsEmitter, getPathNodes, makeEventsEmitter} from "./utils";
import {MemoryFileSystem} from './memory-fs';
import {ensureDir as ensureDir_, walk, WalkEventFile} from 'fs-extra';
import * as Promise from 'bluebird';
const ensureDir = Promise.promisify<void, string>(ensureDir_);

export class LocalFileSystem implements FileSystem{
    public readonly events: InternalEventsEmitter = makeEventsEmitter();

    constructor(public baseUrl = 'http://fake') {
        // this.baseUrl += '/';
    }

    saveFile(fullPath: string, newContent: string): Promise<void> {
        return Promise.reject(new Error('implement me'));
    }

    deleteFile(fullPath: string): Promise<void> {
        return Promise.reject(new Error('implement me'));
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return Promise.reject(new Error('implement me'));
    }

    loadTextFile(fullPath: string): Promise<string> {
        return Promise.reject(new Error('implement me'));
    }

    loadDirectoryTree (): Promise<Directory> {
        // using an in-memory instance to build the result
        const promises:Array<Promise<void>> = [];
        const memFs = new MemoryFileSystem();
        return Promise.fromCallback<Directory>((callback) => {
            const baseUrl = this.baseUrl;
            walk(baseUrl)
                .on('readable', function () {
                    var item:WalkEventFile;
                    while ((item = this.read())) {
                        const path = item.path.substr(baseUrl.length);
                        if (item.stats.isDirectory()){
                            promises.push(memFs.ensureDirectory(path));
                        } else if (item.stats.isFile()){
                            promises.push(memFs.saveFile(path, ''));
                        } else {
                            console.warn(`unknown node type at ${path}`, item);
                        }
                    }
                })
                .on('end', function () {
                    Promise.all(promises)
                        .then(() => memFs.loadDirectoryTree())
                        .then(callback.bind(null, null));
                });
        });
    }

    ensureDirectory(fullPath: string): Promise<void> {
        return ensureDir(fullPath);
    }
}
