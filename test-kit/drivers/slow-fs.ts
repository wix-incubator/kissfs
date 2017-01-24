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
    public readonly fs: FileSystem;
    public baseUrl: string;

    constructor(private timer, private delay: number) {
        this.fs = new MemoryFileSystem();
        this.events = this.fs.events as InternalEventsEmitter;
    }

    saveFile(fullPath:string, newContent:string):Promise<void> {
        this.timer.tick(this.delay);
        return this.fs.saveFile(fullPath, newContent);
    }

    deleteFile(fullPath:string):Promise<void> {
        this.timer.tick(this.delay);
        return this.fs.deleteFile(fullPath);
    }

    deleteDirectory(fullPath: string, recursive: boolean = false): Promise<void> {
        this.timer.tick(this.delay);
        return this.fs.deleteDirectory(fullPath, recursive);
    }

    ensureDirectory(fullPath:string): Promise<void> {
        this.timer.tick(this.delay);
        return this.fs.ensureDirectory(fullPath);
    }

    loadTextFile(fullPath): Promise<string>{
        this.timer.tick(this.delay);
        return this.fs.loadTextFile(fullPath);
    }

    loadDirectoryTree(): Promise<Directory> {
        this.timer.tick(this.delay);
        return this.fs.loadDirectoryTree()
    }
}
