import {access, ensureDir, readFile, readdir, remove, rmdir, stat, writeFile} from 'fs-extra';
import * as walk from 'klaw';
import * as path from 'path';
import {Directory, FileSystem, pathSeparator, ShallowDirectory, File} from './api';
import {getIsIgnored, getPathNodes, InternalEventsEmitter, makeEventsEmitter} from './utils';
import {MemoryFileSystem} from './memory-fs';

// TODO extract chokidar watch mechanism to configuration
export class LocalFileSystemCrudOnly implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    protected isIgnored: (path: string) => boolean = () => false;

    constructor(public baseUrl: string, ignore?: Array<string>) {
        if (ignore) {
            this.isIgnored = getIsIgnored(ignore)
        }
        ;
    }

    saveFile(relPath: string, newContent: string): Promise<void> {
        if (this.isIgnored(relPath)) {
            return Promise.reject(new Error(`Unable to save ignored path: '${relPath}'`));
        }

        const pathArr = getPathNodes(relPath);
        const name = pathArr.pop() || '';
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return ensureDir(fullPath)
            .then(() => writeFile(path.join(fullPath, name), newContent));
    }

    deleteFile(relPath: string): Promise<void> {
        if (!relPath) {
            return Promise.reject(new Error(`Can't delete root directory`));
        }
        if (this.isIgnored(relPath)) {
            return Promise.resolve();
        }
        const fullPath = path.join(this.baseUrl, ...getPathNodes(relPath));
        return access(fullPath)
            .then(() => stat(fullPath), () => null)
            .then(stats => {
                if (stats) {
                    if (stats.isFile()) {
                        return remove(fullPath);
                    } else {
                        throw new Error(`not a file: ${relPath}`);
                    }
                }
            });
    }

    deleteDirectory(relPath: string, recursive?: boolean): Promise<void> {
        const pathArr = getPathNodes(relPath);
        if (pathArr.length === 0) {
            return Promise.reject(new Error(`Can't delete root directory`));
        }
        if (this.isIgnored(relPath)) {
            return Promise.resolve();
        }
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return access(fullPath)
            .then(() => stat(fullPath), () => null)
            .then(stats => {
                if (stats) {
                    if (stats.isDirectory()) {
                        return recursive ? remove(fullPath) : rmdir(fullPath);
                    } else {
                        throw new Error(`not a directory: ${relPath}`);
                    }
                }
            });
    }

    loadTextFile(relPath: string): Promise<string> {
        if (this.isIgnored(relPath)) {
            return Promise.reject(new Error(`Unable to read ignored path: '${relPath}'`));
        }
        return readFile(path.join(this.baseUrl, relPath), 'utf8');
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        if (this.isIgnored(fullPath)) {
            return Promise.reject(new Error(`Unable to read ignored path: '${fullPath}'`));
        }
        let rootPath = path.join(this.baseUrl, fullPath);
        let pathPrefix = fullPath ? (fullPath + pathSeparator) : fullPath;
        const directoryChildren = await readdir(rootPath);

        const processedChildren = await Promise.all(directoryChildren.map(async item => {
            const itemPath = pathPrefix + item;
            let itemAbsolutePath = path.join(rootPath, item);
            const itemStatus = await stat(itemAbsolutePath);
            if (itemStatus.isDirectory()) {
                return new ShallowDirectory(item, itemPath);
            } else if (itemStatus.isFile()) {
                return new File(item, itemPath);
            } else {
                console.warn(`Unknown node type at ${itemAbsolutePath}`);
                return null;
            }
        }));

        return processedChildren.filter((i): i is File | Directory => i !== null);
    }

    loadDirectoryTree(fullPath: string): Promise<Directory> {
        if (fullPath && this.isIgnored(fullPath)) {
            return Promise.reject(new Error(`Unable to read ignored path: '${fullPath}'`));
        }
        // using an in-memory instance to build the result
        // if fullPath is not empty, memfs will contain a sub-tree of the real FS but the root is the same
        const memFs = new MemoryFileSystem();

        return new Promise<Directory>((resolve, reject) => {
            const {baseUrl, isIgnored} = this;
            const rootPath = fullPath ? path.join(baseUrl, fullPath) : baseUrl;
            const walker = walk(rootPath);
            walker.on('readable', function () {
                let item: walk.Item;
                while ((item = walker.read())) {
                    const itemPath = path.relative(baseUrl, item.path).split(path.sep).join(pathSeparator);
                    if (isIgnored(itemPath)) {
                        return;
                    } else if (item.stats.isDirectory()) {
                        memFs.ensureDirectorySync(itemPath);
                    } else if (item.stats.isFile()) {
                        memFs.saveFileSync(itemPath, '');
                    } else {
                        console.warn(`unknown node type at ${itemPath}`, item);
                    }
                }
            })
                .on('end', function () {
                    resolve(memFs.loadDirectoryTreeSync(fullPath));
                })
                .on('error', reject);
        });
    }

    ensureDirectory(relPath: string): Promise<void> {
        if (this.isIgnored(relPath)) {
            return Promise.reject(new Error(`Unable to read and write ignored path: '${relPath}'`));
        }
        const pathArr = getPathNodes(relPath);
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return ensureDir(fullPath);
    }
}
