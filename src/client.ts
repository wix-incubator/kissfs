import WAMPClientFileSystem from './wamp-client-fs';

let fs
new WAMPClientFileSystem('ws://127.0.0.1:3000/', 'com.kissfs.driver').init()
    .then(fsR => fs = fsR)
    .then(() => fs.saveFile('a.txt', 'aaa'))
    .then(() => fs.saveFile('b.txt', 'bbb'))
    .then(() => fs.loadTextFile('b.txt'))
    .then(data => console.log('b.txt: ', data))
    .then(() => fs.deleteFile('b.txt'))
    .then(() => fs.loadDirectoryTree())
    .then(data => console.log('tree: ', data))


