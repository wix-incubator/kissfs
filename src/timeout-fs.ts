import {
    File,
    FileSystem,
    Directory,
    EventEmitter,
    isDisposable, ShallowDirectory
} from './api';
import { timeoutPromise } from './promise-utils';

export class TimeoutFileSystem implements FileSystem{
    constructor(private timeout: number, private fs: FileSystem) {}

    get events():EventEmitter{
        return this.fs.events;
    }

    get baseUrl():string{
        return this.fs.baseUrl;
    }

    saveFile(fullPath:string, newContent:string): Promise<void>{
        return timeoutPromise(this.timeout, this.fs.saveFile(fullPath , newContent));
    }

    deleteFile(fullPath:string):Promise<void>{
        return timeoutPromise(this.timeout, this.fs.deleteFile(fullPath));
    }

    deleteDirectory(fullPath:string, recursive?:boolean):Promise<void>{
        return timeoutPromise(this.timeout, this.fs.deleteDirectory(fullPath , recursive));
    }

    loadTextFile(fullPath:string): Promise<string>{
        return timeoutPromise(this.timeout, this.fs.loadTextFile(fullPath));
    }

    loadDirectoryTree(fullPath?:string): Promise<Directory>{
        return timeoutPromise(this.timeout, this.fs.loadDirectoryTree(fullPath));
    }

    loadDirectoryChildren(fullPath:string): Promise<(File | ShallowDirectory)[]> {
        return timeoutPromise(this.timeout, this.fs.loadDirectoryChildren(fullPath));
    }

    ensureDirectory(fullPath:string): Promise<void>{
        return timeoutPromise(this.timeout, this.fs.ensureDirectory(fullPath));
    }

    dispose() {
        if (isDisposable(this.fs)) this.fs.dispose();
    }
}
