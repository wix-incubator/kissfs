import {FileSystem, Directory,EventEmitter, pathSeparator, FileSystemNode} from "./api";
import * as Promise from 'bluebird';

export class TimeoutFs implements FileSystem{
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

    loadDirectoryTree(): Promise<Directory>{
        return this.fs.loadDirectoryTree().timeout(this.timeout);
    }

    ensureDirectory(fullPath:string): Promise<void>{
        return this.fs.ensureDirectory(fullPath).timeout(this.timeout);
    }
}
