import {
    File,
    FileSystem,
    Directory,
    EventEmitter,
    pathSeparator,
    FileSystemNode,
    isDisposable, ShallowDirectory
} from './api';

import * as Promise from 'bluebird';

export class TimeoutFileSystem implements FileSystem{
    constructor(private timeout: number, private fs: FileSystem) {}

    get events():EventEmitter{
        return this.fs.events;
    }

    get baseUrl():string{
        return this.fs.baseUrl;
    }

    saveFile(fullPath:string, newContent:string): Promise<void>{
        return this.fs.saveFile(fullPath , newContent).timeout(this.timeout);
    }

    deleteFile(fullPath:string):Promise<void>{
        return this.fs.deleteFile(fullPath).timeout(this.timeout);
    }

    deleteDirectory(fullPath:string, recursive?:boolean):Promise<void>{
        return this.fs.deleteDirectory(fullPath , recursive).timeout(this.timeout);
    }

    loadTextFile(fullPath:string): Promise<string>{
        return this.fs.loadTextFile(fullPath).timeout(this.timeout);
    }

    loadDirectoryTree(fullPath?:string): Promise<Directory>{
        return this.fs.loadDirectoryTree(fullPath).timeout(this.timeout);
    }

    loadDirectoryChildren(fullPath:string): Promise<(File | ShallowDirectory)[]> {
        return this.fs.loadDirectoryChildren(fullPath).timeout(this.timeout);
    }

    ensureDirectory(fullPath:string): Promise<void>{
        return this.fs.ensureDirectory(fullPath).timeout(this.timeout);
    }

    dispose() {
        if (isDisposable(this.fs)) this.fs.dispose();
    }
}
