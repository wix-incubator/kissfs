import {access, ensureDir, readFile, readFileSync, remove, rmdir, stat, statSync, writeFile} from 'fs-extra';
import * as path from 'path';
import {Directory, DirectoryContent, File, ShallowDirectory, SimpleStats} from './model';
import {getPathNodes} from './utils';
import {KLAW_SHALLOW_OPTIONS, klawAsPromised, klawItemsToMemFs} from "./klaw";
import klawSync = require("klaw-sync");
import {Stats} from "fs";

function statToSimpleStat(nodeStat: Stats, fullPath:string): SimpleStats{
    if (nodeStat.isDirectory()) {
        return {type: 'dir'};
    } else if (nodeStat.isFile()) {
        return {type: 'file'};
    }
    throw new Error(`Unsupported type ${fullPath}`);
}

async function getStatsForDeletion(baseUrl:string, relPath:string){
    if (!relPath) {
        throw new Error(`Can't delete root directory`);
    }
    const fullPath = path.join(baseUrl, relPath);
    try {
        await access(fullPath);
        return {fullPath, stats: await stat(fullPath)};
    } catch (e) {
        return null;
    }
}

export class LocalFileSystemCrudOnly {

    constructor(public baseUrl: string) {
    }

    async saveFile(relPath: string, newContent: string): Promise<void> {
        const {fullPath, name} = this.getPathAndName(relPath);
        await ensureDir(fullPath);
        await writeFile(path.join(fullPath, name), newContent);
    }

    async deleteFile(relPath: string): Promise<void> {
        const res = await getStatsForDeletion(this.baseUrl, relPath);
        if (res) {
            if (res.stats.isFile()) {
                await remove(res.fullPath);
            } else {
                throw new Error(`not a file: ${relPath}`);
            }
        }
    }

    async deleteDirectory(relPath: string, recursive?: boolean): Promise<void> {
        const res =  await getStatsForDeletion(this.baseUrl, relPath);
        if (res) {
            if (res.stats.isDirectory()) {
                await (recursive ? remove(res.fullPath) : rmdir(res.fullPath));
            } else {
                throw new Error(`not a directory: ${relPath}`);
            }
        }

    }

    async loadTextFile(relPath: string): Promise<string> {
        return readFile(path.join(this.baseUrl, relPath), 'utf8');
    }

    loadTextFileSync(relPath: string): string {
        return readFileSync(path.join(this.baseUrl, relPath), 'utf8');
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        const rootPath = fullPath ? path.join(this.baseUrl, fullPath) : this.baseUrl;
        const items = await klawAsPromised(rootPath, KLAW_SHALLOW_OPTIONS);
        const memFs = klawItemsToMemFs(items, this.baseUrl, false);
        return memFs.loadDirectoryChildren(fullPath);
    }

    loadDirectoryChildrenSync(fullPath: string): Array<File | ShallowDirectory> {
        const rootPath = fullPath ? path.join(this.baseUrl, fullPath) : this.baseUrl;
        const items = klawSync(rootPath, KLAW_SHALLOW_OPTIONS);
        const memFs = klawItemsToMemFs(items, this.baseUrl, false);
        return memFs.loadDirectoryChildrenSync(fullPath);
    }

    async loadDirectoryTree(fullPath?: string): Promise<Directory> {
        const rootPath = fullPath ? path.join(this.baseUrl, fullPath) : this.baseUrl;
        const items = await klawAsPromised(rootPath);
        const memFs = klawItemsToMemFs(items, this.baseUrl, false);
        return memFs.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryTreeSync(fullPath?: string): Directory {
        const rootPath = fullPath ? path.join(this.baseUrl, fullPath) : this.baseUrl;
        const items = klawSync(rootPath);
        const memFs = klawItemsToMemFs(items, this.baseUrl, false);
        return memFs.loadDirectoryTreeSync(fullPath);
    }

    loadDirectoryContentSync(fullPath: string = ''): DirectoryContent {
        const rootPath = fullPath ? path.join(this.baseUrl, fullPath) : this.baseUrl;
        const items = klawSync(rootPath);
        const memFs = klawItemsToMemFs(items, this.baseUrl, true);
        return memFs.loadDirectoryContentSync(fullPath);
    }

    async stat(fullPath: string): Promise<SimpleStats> {
        return statToSimpleStat(await stat(path.join(this.baseUrl, fullPath)), fullPath);
    }

    statSync(fullPath: string): SimpleStats {
        return statToSimpleStat(statSync(path.join(this.baseUrl, fullPath)), fullPath);
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
