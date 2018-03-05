import * as path from 'path';
import {FSWatcher, watch} from 'chokidar';
import {retryPromise, RetryPromiseOptions} from './promise-utils';
import {Correlation, EventEmitter, Events, FileSystem} from './api';
import {Directory, File, pathSeparator, ShallowDirectory} from './model';
import {LocalFileSystemCrudOnly} from './local-fs-crud-only';
import {makeCorrelationId} from "./utils";
import {EventHandler, EventsManager} from "./events-manager";

export type Options = RetryPromiseOptions & {
    correlationWindow: number;
    eventBufferMs: number;
};

export class LocalFileSystem implements FileSystem {
    private readonly eventsManager = new EventsManager();
    public readonly events: EventEmitter = this.eventsManager.events;
    private crud: LocalFileSystemCrudOnly;
    private watcher: FSWatcher;

    constructor(public baseUrl: string,
                ignore?: Array<string>,
                private options: Options = {
                    interval: 100,
                    retries: 3,
                    correlationWindow: 10000,
                    eventBufferMs: 10
                }) {
        this.crud = new LocalFileSystemCrudOnly(baseUrl, ignore);
    }

    init(): Promise<LocalFileSystem> {
        this.watcher = watch([this.baseUrl], {
            //  usePolling:true,
            //  interval:100,
            ignored: (path: string) => this.crud.isIgnored(path),
            //    atomic: false, //todo 50?
            cwd: this.baseUrl
        });

        this.watcher.on('error', err => console.log('Error in LocalFileSystem watch', err));

        return new Promise<LocalFileSystem>(resolve => {
            this.watcher.once('ready', () => {

                this.watcher.on('addDir', (relPath: string) => {
                    if (relPath) { // ignore event of root folder creation
                        this.eventsManager.emit({
                            type: 'directoryCreated',
                            fullPath: relPath.split(path.sep).join(pathSeparator)
                        });
                    }
                });

                this.watcher.on('add', (relPath: string) => {
                    retryPromise(
                        () => this.loadTextFile(relPath)
                            .then(content => this.eventsManager.emit({
                                type: 'fileCreated',
                                fullPath: relPath.split(path.sep).join(pathSeparator),
                                newContent: content
                            })),
                        this.options
                    ).catch(() => this.eventsManager.emit({type: 'unexpectedError'}));
                });

                this.watcher.on('change', (relPath: string) => {
                    retryPromise(
                        () => this.loadTextFile(relPath)
                            .then((content) => this.eventsManager.emit({
                                type: 'fileChanged',
                                fullPath: relPath.split(path.sep).join(pathSeparator),
                                newContent: content
                            })),
                        this.options
                    ).catch(() => this.eventsManager.emit({type: 'unexpectedError'}));
                });

                this.watcher.on('unlinkDir', (relPath: string) =>
                    this.eventsManager.emit({
                        type: 'directoryDeleted',
                        fullPath: relPath.split(path.sep).join(pathSeparator)
                    }));

                this.watcher.on('unlink', (relPath: string) =>
                    this.eventsManager.emit({
                        type: 'fileDeleted',
                        fullPath: relPath.split(path.sep).join(pathSeparator)
                    }));

                resolve(this);
            });
        });
    }

    dispose() {
        this.watcher.close();
    }


    async saveFile(fullPath: string, newContent: string, correlation?:Correlation): Promise<Correlation> {
        correlation = correlation || makeCorrelationId();
        this.registerCorrelationForPathsInDir(fullPath, correlation, 'directoryCreated')
        this.registerCorrelator(['fileChanged', 'fileCreated'], correlation, e => e.fullPath === fullPath && e.newContent === newContent, true);
        await this.crud.saveFile(fullPath, newContent);
        return correlation;
    }

    async deleteFile(fullPath: string, correlation?:Correlation): Promise<Correlation> {
        correlation = correlation || makeCorrelationId();
        this.registerCorrelator(['fileDeleted'], correlation, e => e.fullPath === fullPath, true);
        await this.crud.deleteFile(fullPath);
        return correlation;
    }

    async deleteDirectory(fullPath: string, recursive?: boolean, correlation?:Correlation): Promise<Correlation> {
        correlation = correlation || makeCorrelationId();
        this.registerCorrelator(['directoryDeleted'], correlation, e => e.fullPath === fullPath, true);
        if (recursive) {
            const prefix = fullPath + pathSeparator;
            this.registerCorrelator(['directoryDeleted', 'fileDeleted'], correlation, e => e.fullPath.startsWith(prefix), false);
        };
        await this.crud.deleteDirectory(fullPath, recursive);

        return correlation;
    }

    async ensureDirectory(fullPath: string, correlation?:Correlation): Promise<Correlation> {
        correlation = correlation || makeCorrelationId();
        this.registerCorrelationForPathsInDir(fullPath, correlation, 'directoryCreated')
        // this.registerCorrelator(['directoryCreated'], correlation, e => fullPath.startsWith(e.fullPath), true);
        await this.crud.ensureDirectory(fullPath);
        return correlation;
    }

    loadTextFile(fullPath: string): Promise<string> {
        return this.crud.loadTextFile(fullPath);
    }

    loadDirectoryTree(fullPath?: string): Promise<Directory> {
        return this.crud.loadDirectoryTree(fullPath);
    }

    loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        return this.crud.loadDirectoryChildren(fullPath);
    }

    registerCorrelationForPathsInDir(fullPath:string, correlation:Correlation, eventname:keyof Events){
        const suspectedNewDirs = fullPath.split('/');
        let currentDirPath = '';
        suspectedNewDirs.forEach(dirName=>{
            currentDirPath += dirName;
            let dirPath = currentDirPath;
            this.registerCorrelator([eventname], correlation, e => {
                return dirPath===(e as any).fullPath
            }, true);
            currentDirPath += '/';
        })
    }

    private registerCorrelator<S extends keyof Events>(types: S[], correlation: Correlation, filter: (e: Events[S]) => boolean, single: boolean) {
        let timeout:NodeJS.Timer;
        const correlator: EventHandler<S> = {
            types,
            filter,
            apply: (e: Events[S]) => {
                if(this.options.eventBufferMs && !e.correlation && single){
                    if(timeout){
                        clearTimeout(timeout)
                    }
                    timeout = setTimeout(()=>{
                        e.correlation = correlation;
                        if (single) {
                            this.eventsManager.removeEventHandler(correlator);
                        }
                        this.eventsManager.emit(e);
                    },this.options.eventBufferMs)
                    return undefined;
                }
                e.correlation = correlation;
                if (single) {
                    this.eventsManager.removeEventHandler(correlator);
                }
                return e;
            },
        };
        this.eventsManager.addEventHandler(correlator, this.options.correlationWindow);
    }
}
