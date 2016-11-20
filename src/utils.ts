import {pathSeparator} from './api';

export function getPathNodes(path:string):string[]{
    return path.split(pathSeparator).filter(n => n.length !== 0);
}
