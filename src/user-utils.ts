import {FileSystem, FileSystemReadSync} from "./api";
import {checkExistsInDir, splitPathToDirAndFile} from "./utils";

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
