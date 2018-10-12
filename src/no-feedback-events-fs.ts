import {Directory, DirectoryContent, File, ShallowDirectory, SimpleStats} from './model';
import {Correlation, EventEmitter, FileSystem, fileSystemEventNames, FileSystemReadSync} from './api';
import {EventsManager} from './events-manager';
import {makeCorrelationId} from './utils';

export namespace NoFeedbackEventsFileSystem {
    export type Options = {
        delayEvents: number;
        correlationWindow: number;
    };
}

export class NoFeedbackEventsFileSystem implements FileSystem {
    public baseUrl: string;
    private readonly eventsManager = new EventsManager({delay: this.options.delayEvents});
    public readonly events: EventEmitter = this.eventsManager.events;
    private readonly correlateOnce = new Set<Correlation>();
    private readonly correlateByWindow = new Set<Correlation>();

    constructor(private fs: FileSystem, private options: NoFeedbackEventsFileSystem.Options = {
        delayEvents: 1,
        correlationWindow: 10000
    }) {
        this.baseUrl = fs.baseUrl;
        this.eventsManager.addEventHandler({
            types: fileSystemEventNames,
            filter: (e) => {
                return !!e.correlation && (this.correlateByWindow.has(e.correlation) || this.correlateOnce.delete(e.correlation));
            },
            apply: () => {
            }, // don't return an event
        });
        const emit = this.eventsManager.emit.bind(this.eventsManager);
        fileSystemEventNames.forEach(type => this.fs.events.on(type, emit));
    }

    async saveFile(fullPath: string, newContent: string, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        this.registerCorrelation(correlation, false);
        return await this.fs.saveFile(fullPath, newContent, correlation);
    }

    async deleteFile(fullPath: string, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        this.registerCorrelation(correlation, true);
        return await this.fs.deleteFile(fullPath, correlation);
    }

    async deleteDirectory(fullPath: string, recursive?: boolean, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        this.registerCorrelation(correlation, !recursive);
        return await this.fs.deleteDirectory(fullPath, recursive, correlation);
    }

    async ensureDirectory(fullPath: string, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        this.registerCorrelation(correlation, false);
        return await this.fs.ensureDirectory(fullPath, correlation);
    }

    loadTextFile(fullPath: string): Promise<string> {
        return this.fs.loadTextFile(fullPath);
    }

    loadDirectoryTree(fullPath?: string): Promise<Directory> {
        return this.fs.loadDirectoryTree(fullPath);
    }

    loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        return this.fs.loadDirectoryChildren(fullPath);
    }

    stat(fullPath: string): Promise<SimpleStats> {
        return this.fs.stat(fullPath);
    }

    protected registerCorrelation(correlation: Correlation, once: boolean) {
        const targetSet = once ? this.correlateOnce : this.correlateByWindow;
        targetSet.add(correlation);
        setTimeout(() => targetSet.delete(correlation), this.options.correlationWindow);
        return correlation;
    }
}

export class NoFeedbackEventsFileSystemSync extends NoFeedbackEventsFileSystem implements FileSystemReadSync {

    constructor(private syncFs: FileSystemReadSync) {
        super(syncFs);
    }

    loadTextFileSync(fullPath: string): string {
        return this.syncFs.loadTextFileSync(fullPath);
    }

    loadDirectoryTreeSync(fullPath?: string | undefined): Directory {
        return this.syncFs.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryChildrenSync(fullPath: string): (File | ShallowDirectory)[] {
        return this.syncFs.loadDirectoryChildrenSync(fullPath);
    }

    loadDirectoryContentSync(fullPath: string = ''): DirectoryContent {
        return this.syncFs.loadDirectoryContentSync(fullPath);
    }

    statSync(fullPath: string): SimpleStats {
        return this.syncFs.statSync(fullPath);
    }
}
