import {Correlation, FileSystem, isDisposable} from '../src/api';
import {MemoryFileSystem} from '../src/memory-fs';
import {InternalEventsEmitter} from '../src/utils';
import {delayedPromise} from '../src/promise-utils';
import {Directory, File, ShallowDirectory, SimpleStats} from '../src/model';

export class SlowFs implements FileSystem {
    public readonly events: InternalEventsEmitter;
    public baseUrl: string = 'slow';
    private fs: FileSystem;

    constructor(private delay: number) {
        this.fs = new MemoryFileSystem();
        this.events = this.fs.events as InternalEventsEmitter;
    }

    async saveFile(fullPath: string, newContent: string, correlation?: Correlation): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.saveFile(fullPath, newContent, correlation);
    }

    async deleteFile(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.deleteFile(fullPath, correlation);
    }

    async deleteDirectory(fullPath: string, recursive: boolean = false, correlation?: Correlation): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.deleteDirectory(fullPath, recursive, correlation);
    }

    async ensureDirectory(fullPath: string, correlation?: Correlation): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.ensureDirectory(fullPath, correlation);
    }

    async loadTextFile(fullPath: string): Promise<string> {
        await delayedPromise(this.delay);
        return this.fs.loadTextFile(fullPath);
    }

    async loadDirectoryTree(fullPath?: string): Promise<Directory> {
        await delayedPromise(this.delay);
        return this.fs.loadDirectoryTree(fullPath);
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        await delayedPromise(this.delay);
        return this.fs.loadDirectoryChildren(fullPath);
    }

    async stat(fullPath: string): Promise<SimpleStats> {
        await delayedPromise(this.delay);
        return this.fs.stat(fullPath);
    }

    dispose() {
        setTimeout(() => isDisposable(this.fs) && this.fs.dispose(), this.delay);
    }
}
