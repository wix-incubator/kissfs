import {Directory, File, FileSystem, isDisposable, ShallowDirectory} from "../../src/api";

import {MemoryFileSystem} from '../../src/memory-fs';
import {InternalEventsEmitter} from '../../src/utils';
import {ignoredDir, ignoredFile} from '../../test/implementation-suite';
import {delayedPromise} from '../../src/promise-utils';

export class SlowFs implements FileSystem {
    public readonly events: InternalEventsEmitter;
    public baseUrl: string;
    private fs: FileSystem;

    constructor(private delay: number) {
        this.fs = new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]);
        this.events = this.fs.events as InternalEventsEmitter;
    }

    saveFile(fullPath: string, newContent: string): Promise<void> {
        return delayedPromise(this.delay).then(() => this.fs.saveFile(fullPath, newContent));
    }

    deleteFile(fullPath: string): Promise<void> {
        return delayedPromise(this.delay).then(() => this.fs.deleteFile(fullPath));
    }

    deleteDirectory(fullPath: string, recursive: boolean = false): Promise<void> {
        return delayedPromise(this.delay).then(() => this.fs.deleteDirectory(fullPath, recursive));
    }

    ensureDirectory(fullPath: string): Promise<void> {
        return delayedPromise(this.delay).then(() => this.fs.ensureDirectory(fullPath));
    }

    loadTextFile(fullPath: string): Promise<string> {
        return delayedPromise(this.delay).then(() => this.fs.loadTextFile(fullPath));
    }

    loadDirectoryTree(fullPath?: string): Promise<Directory> {
        return delayedPromise(this.delay).then(() => this.fs.loadDirectoryTree(fullPath));
    }

    loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        return delayedPromise(this.delay).then(() => this.fs.loadDirectoryChildren(fullPath));
    }

    dispose() {
        setTimeout(() => isDisposable(this.fs) && this.fs.dispose(), this.delay);
    }
}
