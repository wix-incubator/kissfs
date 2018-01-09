import {
    Correlation,
    Directory,
    EventEmitter,
    File,
    FileSystem,
    fileSystemEventNames,
    FileSystemReadSync,
    ShallowDirectory
} from "./api";
import {EventsManager} from "./events-manager";

export type Options = {
    delayEvents: number;
    correlationWindow: number;
};

export class NoFeedbackEventsFileSystem implements FileSystem {
    private readonly eventsManager = new EventsManager({delay: this.options.delayEvents});
    public readonly events: EventEmitter = this.eventsManager.events;
    private readonly correlateOnce = new Set<Correlation>();
    private readonly correlateByWindow = new Set<Correlation>();
    public baseUrl: string;

    constructor(private fs: FileSystem, private options: Options = {delayEvents: 1, correlationWindow: 10000}) {
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

    protected registerCorrelation(correlation: Correlation, once: boolean) {
        const targetSet = once ? this.correlateOnce : this.correlateByWindow;
        targetSet.add(correlation);
        setTimeout(() => targetSet.delete(correlation), this.options.correlationWindow);
        return correlation;
    }

    async saveFile(fullPath: string, newContent: string): Promise<Correlation> {
        return this.registerCorrelation(await this.fs.saveFile(fullPath, newContent), false);
    }

    async deleteFile(fullPath: string): Promise<Correlation> {
        return this.registerCorrelation(await this.fs.deleteFile(fullPath), true);
    }

    async deleteDirectory(fullPath: string, recursive?: boolean): Promise<Correlation> {
        return this.registerCorrelation(await this.fs.deleteDirectory(fullPath, recursive), !recursive);
    }

    async ensureDirectory(fullPath: string): Promise<Correlation> {
        return this.registerCorrelation(await this.fs.ensureDirectory(fullPath), false);
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
}
