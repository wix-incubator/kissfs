import * as Promise from 'bluebird';
import {
    FileSystem,
    Directory,
    File,
    isDir,
    fileSystemMethods
} from "../../src/api";

import {MemoryFileSystem} from "../../src/memory-fs";
import {InternalEventsEmitter, makeEventsEmitter} from "../../src/utils";

export class SlowFs implements FileSystem {
    public readonly events: InternalEventsEmitter;
    private fs: FileSystem;
    public baseUrl: string;

    constructor(private delay: number) {
        this.fs = new MemoryFileSystem();
        this.events = this.fs.events as InternalEventsEmitter;
    }

    saveFile(fullPath:string, newContent:string):Promise<void> {
        return Promise.delay(this.delay).then(() => this.fs.saveFile(fullPath, newContent));
    }

    deleteFile(fullPath:string):Promise<void> {
        return Promise.delay(this.delay).then(() => this.fs.deleteFile(fullPath));
    }

    deleteDirectory(fullPath: string, recursive: boolean = false): Promise<void> {
        return Promise.delay(this.delay).then(() => this.fs.deleteDirectory(fullPath, recursive));
    }

    ensureDirectory(fullPath:string): Promise<void> {
        return Promise.delay(this.delay).then(() => this.fs.ensureDirectory(fullPath));
    }

    loadTextFile(fullPath): Promise<string>{
        return Promise.delay(this.delay).then(() => this.fs.loadTextFile(fullPath));
    }

    loadDirectoryTree(): Promise<Directory> {
        return Promise.delay(this.delay).then(() => this.fs.loadDirectoryTree());
    }
}
