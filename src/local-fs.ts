import * as Promise from 'bluebird';
import * as retry from 'bluebird-retry';
import {watch} from 'chokidar';
import * as path from 'path';
import {Stats} from 'fs';
import {FSWatcher} from 'chokidar';
import {FileSystem, pathSeparator} from "./api";
import {LocalFileSystemCrudOnly} from './local-fs-crud-only';

export class LocalFileSystem extends LocalFileSystemCrudOnly implements FileSystem {
    private watcher: FSWatcher;

    constructor(
        public baseUrl,
        ignore?: Array<string>,
        private retrySettings: retry.Options = {
            interval: 100,
            max_tries: 3
        }) {
        super(baseUrl, ignore)
    }

    init(): Promise<LocalFileSystem> {
        this.watcher = watch([this.baseUrl], {
            //  usePolling:true,
            //  interval:100,
            ignored: path => (this as any).isIgnored(path),
            //    atomic: false, //todo 50?
            cwd: this.baseUrl
        });

        this.watcher.on('error', err => console.log('Error in LocalFileSystem watch', err));

        return new Promise<LocalFileSystem>(resolve => {
            this.watcher.once('ready', () => {

                this.watcher.on('addDir', (relPath:string, stats:Stats)=> {
                        if (relPath) { // ignore event of root folder creation
                            this.events.emit('directoryCreated', {
                                type: 'directoryCreated',
                                fullPath: relPath.split(path.sep).join(pathSeparator)
                            });
                        }
                    });

                this.watcher.on('add', (relPath:string) => {
                    retry(
                        () => this.loadTextFile(relPath)
                            .then(content => this.events.emit('fileCreated', {
                                type: 'fileCreated',
                                fullPath: relPath.split(path.sep).join(pathSeparator),
                                newContent: content
                            })),
                        this.retrySettings
                    ).catch(() => this.events.emit('unexpectedError', {type: 'unexpectedError'}));
                });

                this.watcher.on('change', (relPath:string) => {
                    retry(
                        () => this.loadTextFile(relPath)
                            .then((content)=>this.events.emit('fileChanged', {
                                type: 'fileChanged',
                                fullPath: relPath.split(path.sep).join(pathSeparator),
                                newContent: content
                            })),
                        this.retrySettings
                    ).catch(() => this.events.emit('unexpectedError', {type: 'unexpectedError'}));
                });

                this.watcher.on('unlinkDir', (relPath:string) =>
                    this.events.emit('directoryDeleted', {
                        type: 'directoryDeleted',
                        fullPath: relPath.split(path.sep).join(pathSeparator)
                    }));

                this.watcher.on('unlink', (relPath:string) =>
                    this.events.emit('fileDeleted', {
                        type: 'fileDeleted',
                        fullPath: relPath.split(path.sep).join(pathSeparator)
                    }));

                resolve(this);
            });
        });
    }

    dispose(){
        this.watcher.close();
    }
}
