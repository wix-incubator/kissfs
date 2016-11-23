import {FileSystem, Directory, pathSeparator, FileSystemNode} from "./api";
import {InternalEventsEmitter, getPathNodes, makeEventsEmitter} from "./utils";
import {MemoryFileSystem} from './memory-fs';
import {walk, WalkEventFile,
    ensureDir as ensureDir_,
    readFile as readFile_,
    writeFile as writeFile_,
    remove as remove_,
    rmdir as rmdir_,
    stat as stat_} from 'fs-extra';
import * as Promise from 'bluebird';
import { watch } from 'chokidar';
import * as path from 'path';
import { FSWatcher, Stats } from 'fs';

const ensureDir = Promise.promisify<void, string>(ensureDir_);
const readFile = Promise.promisify<string, string, string>(readFile_);
const writeFile = Promise.promisify<void, string, any>(writeFile_);
const remove = Promise.promisify<void, string>(remove_ as (dir: string, callback: (err: any, _: void) => void) => void);
const rmdir = Promise.promisify<void, string>(rmdir_ as (dir: string, callback: (err: any, _: void) => void) => void);
const stat = Promise.promisify<Stats, string>(stat_);

// TODO test, move to constructor argument and use in all methods
const blacklist = ['node_modules', '.git', '.idea', 'dist'];
function isBlackListed(file: string) {
    file = file.split(path.sep).pop() || '';
    return blacklist.some((listItem) => listItem === file);
}

// TODO extract chokidar watch mechanism to configuration
export class LocalFileSystem implements FileSystem{
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private watcher: FSWatcher;
    constructor(public baseUrl) {

    }
    init(): Promise<LocalFileSystem>{
        this.watcher = watch([this.baseUrl], {
          //  usePolling:true,
          //  interval:100,
            ignored: isBlackListed,
            //    atomic: false, //todo 50?
            cwd: this.baseUrl
        });

        this.watcher.on('error', err => {
            console.log('Error in LocalFileSystem watch', err);
        });

        return new Promise<LocalFileSystem>(resolve=>{
            this.watcher.once('ready', () => {
                this.watcher.on('all', (name, path) => {
                    console.log('track:', name, path);
                });

                this.watcher.on('addDir', (relPath:string, stats:Stats)=> {

                    if (relPath) { // ignore event of root folder creation
                        this.events.emit('directoryCreated', {
                            type: 'directoryCreated',
                            fullPath: relPath.split(path.sep).join(pathSeparator)
                        });
                    }
                });

                this.watcher.on('add', (relPath:string)=>
                    this.loadTextFile(relPath)
                        .then((content)=>this.events.emit('fileCreated', {
                            type: 'fileCreated',
                            fullPath: relPath.split(path.sep).join(pathSeparator),
                            newContent: content
                        })));

                this.watcher.on('change', (relPath:string)=>
                    this.loadTextFile(relPath)
                        .then((content)=>this.events.emit('fileChanged', {
                            type: 'fileChanged',
                            fullPath: relPath.split(path.sep).join(pathSeparator),
                            newContent: content
                        })));
                this.watcher.on('unlinkDir', (relPath:string)=>
                    this.events.emit('directoryDeleted', {
                        type: 'directoryDeleted',
                        fullPath: relPath.split(path.sep).join(pathSeparator)
                    }));
                // this.watcher.on('unlink', (filename) => {
                //     var event = {
                //         filename: normalizePath(filename)
                //     };
                //     io.emit('file-delete', event);
                // });
                resolve(this);
            });
        });
    }

    saveFile(relPath: string, newContent: string): Promise<void> {
        const pathArr = getPathNodes(relPath);
        const name = pathArr.pop();
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return ensureDir(fullPath)
            .then(()=> writeFile(path.join(fullPath, name), newContent));
    }

    deleteFile(relPath: string): Promise<void> {
        if (!relPath){
            return Promise.reject(new Error(`Can't delete root directory`));
        }
        const fullPath = path.join(this.baseUrl, ...getPathNodes(relPath));
        return stat(fullPath).then(stats => {
            if(stats.isFile()){
                return remove(fullPath);
            } else {
                throw new Error(`not a file: ${relPath}`);
            }
        });
    }

    deleteDirectory(relPath: string, recursive?: boolean): Promise<void> {
        var pathArr = getPathNodes(relPath);
        if (pathArr.length === 0){
            return Promise.reject(new Error(`Can't delete root directory`));
        }
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return stat(fullPath).then(stats => {
            if(stats.isDirectory()){
                return recursive ? rmdir(fullPath) : remove(fullPath);
            } else {
                throw new Error(`not a directory: ${relPath}`);
            }
        });
    }

    loadTextFile(relPath: string): Promise<string> {
        return readFile(path.join(this.baseUrl, relPath), 'utf8');
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
                        const itemPath = path.relative(baseUrl, item.path);
                        if (item.stats.isDirectory()){
                            promises.push(memFs.ensureDirectory(itemPath));
                        } else if (item.stats.isFile()){
                            promises.push(memFs.saveFile(itemPath, ''));
                        } else {
                            console.warn(`unknown node type at ${itemPath}`, item);
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

    ensureDirectory(relPath: string): Promise<void> {
        const pathArr = getPathNodes(relPath);
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return ensureDir(fullPath);
    }
}
