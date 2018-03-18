import {Correlation, FileSystem, isDisposable} from "../src/api";

import {MemoryFileSystem} from '../src/memory-fs';
import {InternalEventsEmitter} from '../src/utils';
import {ignoredDir, ignoredFile} from './implementation-suite';
import {delayedPromise} from '../src/promise-utils';
import {Directory, File, ShallowDirectory} from "../src/model";

export class SlowFs implements FileSystem {
    public readonly events: InternalEventsEmitter;
    public baseUrl: string = 'slow';
    private fs: FileSystem;

    constructor(private delay: number) {
        this.fs = new MemoryFileSystem(undefined, {ignore: [ignoredDir, ignoredFile]});
        this.events = this.fs.events as InternalEventsEmitter;
    }

    async saveFile(fullPath: string, newContent: string): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.saveFile(fullPath, newContent);
    }

    async deleteFile(fullPath: string): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.deleteFile(fullPath);
    }

    async deleteDirectory(fullPath: string, recursive: boolean = false): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.deleteDirectory(fullPath, recursive);
    }

    async ensureDirectory(fullPath: string): Promise<Correlation> {
        await delayedPromise(this.delay);
        return this.fs.ensureDirectory(fullPath);
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

    dispose() {
        setTimeout(() => isDisposable(this.fs) && this.fs.dispose(), this.delay);
    }
}
