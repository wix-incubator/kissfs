import WampClientFileSystem from './wamp-client-fs';
import {wampRealm} from './utils';

let fs
new WampClientFileSystem('ws://127.0.0.1:3000/', wampRealm).init()
    .then(fsR => fs = fsR)
    .then(() => fs.saveFile('a.txt', 'aaa'))
    .then(() => fs.saveFile('b.txt', 'bbb'))
    .then(() => fs.loadTextFile('b.txt'))
    .then(data => console.log('b.txt: ', data))
    .then(() => fs.deleteFile('b.txt'))
    .then(() => fs.loadDirectoryTree())
    .then(data => console.log('tree: ', data))


