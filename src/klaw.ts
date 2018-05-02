import * as klaw from 'klaw';
import {MemoryFileSystem} from './memory-fs';
import {pathSeparator} from './model';
import {readFileSync} from 'fs-extra';
import * as path from 'path';

// patching declarations of klaw and klaw-sync to support latest depth feature
declare module 'klaw' {
    export interface Options {
        depthLimit?: number;
    }
}

declare module 'klaw-sync' {
    export interface Options {
        depthLimit?: number;
    }
}

export const KLAW_SHALLOW_OPTIONS = {depthLimit: 0};

export function klawItemsToMemFs(items: ReadonlyArray<klaw.Item>, baseUrl: string, readFile: boolean) {
    const memFs = new MemoryFileSystem();
    items.forEach(item => {
        const itemPath = path.relative(baseUrl, item.path).split(path.sep).join(pathSeparator);
        if (item.stats.isDirectory()) {
            memFs.ensureDirectorySync(itemPath);
        } else if (item.stats.isFile()) {
            memFs.saveFileSync(itemPath, readFile ? readFileSync(item.path, 'utf8') : '');
        } else {
            console.warn(`unknown node type at ${itemPath}`, item);
        }
    });
    return memFs;
}

export function klawAsPromised(rootPath: string, options?: klaw.Options): Promise<klaw.Item[]> {
    return new Promise<klaw.Item[]>((resolve, reject) => {
        const items: klaw.Item[] = [];
        const walker = klaw(rootPath, options);
        walker
            .on('readable', function () {
                let item: klaw.Item;
                while ((item = walker.read())) {
                    items.push(item);
                }
            })
            .on('error', reject)
            .on('end', function () {
                resolve(items);
            });
    });
}
