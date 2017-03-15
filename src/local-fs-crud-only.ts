import {
    WalkEventFile,
    ensureDir as ensureDir_,
    readFile as readFile_,
    writeFile as writeFile_,
    remove as remove_,
    rmdir as rmdir_,
    access as access_,
    stat as stat_
} from 'fs-extra';
import * as walk from 'klaw';
import * as Promise from 'bluebird';
import * as path from 'path';
import {Stats} from 'fs';
import {FileSystem, Directory, pathSeparator} from "./api";
import {
    InternalEventsEmitter,
    getPathNodes,
    makeEventsEmitter,
    getIsIgnored
} from "./utils";
import {MemoryFileSystem} from './memory-fs';

const ensureDir = Promise.promisify<void, string>(ensureDir_);
const readFile = Promise.promisify<string, string, string>(readFile_);
const writeFile = Promise.promisify<void, string, any>(writeFile_);
const remove = Promise.promisify<void, string>(remove_ as (dir: string, callback: (err: any, _: void) => void) => void);
const rmdir = Promise.promisify<void, string>(rmdir_ as (dir: string, callback: (err: any, _: void) => void) => void);
const stat = Promise.promisify<Stats, string>(stat_);
const access = Promise.promisify<void, string>(access_);

// TODO extract chokidar watch mechanism to configuration
export class LocalFileSystemCrudOnly implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private ignore: Array<string> = [];
    private isIgnored: (path: string) => boolean = (path: string) => false;

    constructor(public baseUrl, ignore?: Array<string>) {
        if (ignore) {
            this.isIgnored = getIsIgnored(ignore)
        };
    }

    saveFile(relPath: string, newContent: string): Promise<void> {
        if (this.isIgnored(relPath)) {
            return Promise.reject(new Error(`Unable to save ignored path: '${relPath}'`));
        }

        const pathArr = getPathNodes(relPath);
        const name = pathArr.pop() || '';
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return ensureDir(fullPath)
            .then(()=> writeFile(path.join(fullPath, name), newContent));
    }

    deleteFile(relPath: string): Promise<void> {
        if (!relPath){
            return Promise.reject(new Error(`Can't delete root directory`));
        }
        if (this.isIgnored(relPath)) {
            return Promise.resolve();
        }
        const fullPath = path.join(this.baseUrl, ...getPathNodes(relPath));
        return access(fullPath)
            .then(() => stat(fullPath), err => null)
            .then(stats => {
                if (stats) {
                    if (stats.isFile()) {
                        return remove(fullPath);
                    } else {
                        throw new Error(`not a file: ${relPath}`);
                    }
                }
            });
    }

    deleteDirectory(relPath: string, recursive?: boolean): Promise<void> {
        const pathArr = getPathNodes(relPath);
        if (pathArr.length === 0){
            return Promise.reject(new Error(`Can't delete root directory`));
        }
        if (this.isIgnored(relPath)) {
            return Promise.resolve();
        }
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return access(fullPath)
            .then(() => stat(fullPath), err => null)
            .then(stats => {
                if (stats) {
                    if (stats.isDirectory()) {
                        return recursive ? remove(fullPath): rmdir(fullPath);
                    } else {
                        throw new Error(`not a directory: ${relPath}`);
                    }
                }
            });
    }

    loadTextFile(relPath: string): Promise<string> {
        if (this.isIgnored(relPath)) {
            return Promise.reject(new Error(`Unable to read ignored path: '${relPath}'`));
        }
        return readFile(path.join(this.baseUrl, relPath), 'utf8');
    }

    loadDirectoryTree(): Promise<Directory> {
        // using an in-memory instance to build the result
        const promises:Array<Promise<void>> = [];
        const memFs = new MemoryFileSystem();
        return Promise.fromCallback<Directory>((callback) => {
            const {baseUrl, isIgnored} = this;
            walk(baseUrl)
                .on('readable', function() {
                    let item:WalkEventFile;
                    while ((item = this.read())) {
                        const itemPath = path.relative(baseUrl, item.path).split(path.sep).join(pathSeparator);
                        if (isIgnored(itemPath)) {
                            return;
                        } else if (item.stats.isDirectory()) {
                            promises.push(memFs.ensureDirectory(itemPath));
                        } else if (item.stats.isFile()) {
                            promises.push(memFs.saveFile(itemPath, ''));
                        } else {
                            console.warn(`unknown node type at ${itemPath}`, item);
                        }
                    }
                })
                .on('end', function() {
                    Promise.all(promises)
                        .then(() => memFs.loadDirectoryTree())
                        .then(callback.bind(null, null));
                });
        });
    }

    ensureDirectory(relPath: string): Promise<void> {
        if (this.isIgnored(relPath)) {
            return Promise.reject(new Error(`Unable to read and write ignored path: '${relPath}'`));
        }
        const pathArr = getPathNodes(relPath);
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return ensureDir(fullPath);
    }
}
