import {Correlation, Directory, EventEmitter, File, FileSystem, FileSystemReadSync, ShallowDirectory} from "./api";
import {EventsManager} from "./events-manager";

export class NoFeedbackEventsFileSystem implements FileSystem {

    private readonly eventsManager = new EventsManager();
    public readonly events: EventEmitter = this.eventsManager.events;
    public baseUrl: string;

    constructor(private fs: FileSystem) {
        this.baseUrl = fs.baseUrl;
    }

    saveFile(fullPath: string, newContent: string): Promise<Correlation> {
        return this.fs.saveFile(fullPath, newContent);
    }

    deleteFile(fullPath: string): Promise<Correlation> {
        return this.fs.deleteFile(fullPath);
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<Correlation> {
        return this.fs.deleteDirectory(fullPath, recursive);
    }

    ensureDirectory(fullPath: string): Promise<Correlation> {
        return this.fs.ensureDirectory(fullPath);
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
