import {Directory, File, ShallowDirectory} from './model';
import {Correlation, EventEmitter, FileSystem, isDisposable} from './api';
import {timeoutPromise} from './promise-utils';

export class TimeoutFileSystem implements FileSystem {
    constructor(private timeout: number, private fs: FileSystem) {
    }

    get events(): EventEmitter {
        return this.fs.events;
    }

    get baseUrl(): string {
        return this.fs.baseUrl;
    }

    saveFile(fullPath: string, newContent: string, correlation?: Correlation): Promise<Correlation> {
        return timeoutPromise(this.fs.saveFile(fullPath, newContent, correlation), this.timeout);
    }

    deleteFile(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        return timeoutPromise(this.fs.deleteFile(fullPath, correlation), this.timeout);
    }

    deleteDirectory(fullPath: string, recursive?: boolean, correlation?: Correlation): Promise<Correlation> {
        return timeoutPromise(this.fs.deleteDirectory(fullPath, recursive, correlation), this.timeout);
    }

    loadTextFile(fullPath: string): Promise<string> {
        return timeoutPromise(this.fs.loadTextFile(fullPath), this.timeout);
    }

    loadDirectoryTree(fullPath?: string): Promise<Directory> {
        return timeoutPromise(this.fs.loadDirectoryTree(fullPath), this.timeout);
    }

    loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        return timeoutPromise(this.fs.loadDirectoryChildren(fullPath), this.timeout);
    }

    ensureDirectory(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        return timeoutPromise(this.fs.ensureDirectory(fullPath, correlation), this.timeout);
    }

    dispose() {
        if (isDisposable(this.fs)) this.fs.dispose();
    }
}
