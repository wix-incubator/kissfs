import {FileSystem, FileSystemReadSync} from "./api";
import {checkExistsInDir, splitPathToDirAndFile} from "./utils";
import {DirectoryContent} from "./model";

export function checkExistsSync(expectedType: 'file' | 'dir', fs: FileSystemReadSync, targetPath: string): boolean {
    const {name, parentPath} = splitPathToDirAndFile(targetPath);
    try {
        let dirContent = fs.loadDirectoryChildrenSync(parentPath);
        return checkExistsInDir(expectedType, dirContent, name)
    } catch (error) {
        return false;
    }
}

export async function checkExists(expectedType: 'file' | 'dir', fs: FileSystem, targetPath: string): Promise<boolean> {
    const {name, parentPath} = splitPathToDirAndFile(targetPath);
    try {
        let dirContent = await fs.loadDirectoryChildren(parentPath);
        return checkExistsInDir(expectedType, dirContent, name)
    } catch (error) {
        return false;
    }
}

async function addContentAsync(content: DirectoryContent, fs: FileSystem, currentPath: string = '') {
    return Promise.all(Object.keys(content).map(async fileOrDirName => {
        const fileOrDir = content[fileOrDirName];
        const newPath = currentPath ? currentPath + '/' + fileOrDirName : fileOrDirName;
        if (typeof fileOrDir === 'string') {
            await fs.saveFile(newPath, fileOrDir);
        } else {
            await fs.ensureDirectory(newPath);
            await addContentAsync(fileOrDir, fs, newPath);
        }
    }));
}
