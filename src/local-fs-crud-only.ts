import {access, ensureDir, readdir, readFile, remove, rmdir, stat, writeFile} from 'fs-extra';
import * as walk from 'klaw';
import * as path from 'path';
import {Directory, File, pathSeparator, ShallowDirectory} from './model';
import {getPathNodes} from './utils';
import {MemoryFileSystem} from './memory-fs';

export class LocalFileSystemCrudOnly {

    constructor(public baseUrl: string) {
    }

    async saveFile(relPath: string, newContent: string): Promise<void> {
        const {fullPath, name} = this.getPathAndName(relPath);
        await ensureDir(fullPath);
        await writeFile(path.join(fullPath, name), newContent);
    }

    async deleteFile(relPath: string): Promise<void> {
        if (!relPath) {
            throw new Error(`Can't delete root directory`);
        }

            const fullPath = path.join(this.baseUrl, ...getPathNodes(relPath));
            let stats;
            try {
                await access(fullPath);
                stats = await stat(fullPath);
            } catch (e) {
            }

            if (stats) {
                if (stats.isFile()) {
                    await remove(fullPath);
                } else {
                    throw new Error(`not a file: ${relPath}`);
                }
            }
    }

    async deleteDirectory(relPath: string, recursive?: boolean): Promise<void> {
        const pathArr = getPathNodes(relPath);
        if (pathArr.length === 0) {
            throw new Error(`Can't delete root directory`);
        }


            const fullPath = path.join(this.baseUrl, ...pathArr);
            let stats;
            try {
                await access(fullPath);
                stats = await stat(fullPath);
            } catch (e) {
            }

            if (stats) {
                if (stats.isDirectory()) {
                    await (recursive ? remove(fullPath) : rmdir(fullPath));
                } else {
                    throw new Error(`not a directory: ${relPath}`);
                }
            }

    }

    async loadTextFile(relPath: string): Promise<string> {
        return readFile(path.join(this.baseUrl, relPath), 'utf8');
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {

        let rootPath = path.join(this.baseUrl, fullPath);
        let pathPrefix = fullPath ? (fullPath + pathSeparator) : fullPath;
        const directoryChildren = await readdir(rootPath);

        const processedChildren = await Promise.all(directoryChildren.map(async item => {
            const itemPath = pathPrefix + item;
            let itemAbsolutePath = path.join(rootPath, item);
            const itemStats = await stat(itemAbsolutePath);
            if (itemStats.isDirectory()) {
                return new ShallowDirectory(item, itemPath);
            } else if (itemStats.isFile()) {
                return new File(item, itemPath);
            } else {
                console.warn(`Unknown node type at ${itemAbsolutePath}`);
                return null;
            }
        }));

        return processedChildren.filter((i): i is File | ShallowDirectory => i !== null);
    }

    async loadDirectoryTree(fullPath?: string): Promise<Directory> {

        // using an in-memory instance to build the result
        // if fullPath is not empty, memfs will contain a sub-tree of the real FS but the root is the same
        const memFs = new MemoryFileSystem();

        return new Promise<Directory>((resolve, reject) => {
            const {baseUrl} = this;
            const rootPath = fullPath ? path.join(baseUrl, fullPath) : baseUrl;
            const walker = walk(rootPath);
            walker
                .on('readable', function () {
                    let item: walk.Item;
                    while ((item = walker.read())) {
                        const itemPath = path.relative(baseUrl, item.path).split(path.sep).join(pathSeparator);
                        if (item.stats.isDirectory()) {
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

    async ensureDirectory(relPath: string): Promise<void> {

        const pathArr = getPathNodes(relPath);
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return ensureDir(fullPath);
    }

    private getPathAndName(relPath: string): { fullPath: string, name: string } {
        const pathArr = getPathNodes(relPath);
        const name = pathArr.pop() || '';
        const fullPath = path.join(this.baseUrl, ...pathArr);
        return {fullPath, name}
    }

}
