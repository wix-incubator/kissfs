import {Server} from 'ws';
import {FileSystem} from './api';
import {MemoryFileSystem} from './memory-fs';

function broadcast(wss: Server, data) {
    console.log('broadcast: ', data);
    wss.clients.forEach(client => {
        client.send(JSON.stringify(data));
    });
}

function wsOverFs(fs: FileSystem, port=3000) {
    const wss = new Server({port: 3000});

    ['fileCreated', 'fileChanged', 'fileDeleted', 'directoryCreated', 'directoryDeleted'].forEach(ev => {
        fs.events.on(ev as any, data => broadcast(wss, data))
    })

    // fs.events.on('fileCreated', data => {
    //     console.log('fileCreated: ', data)
    // })
    wss.on('connection', ws => {
        ws.on('message', message => {
            console.log('message: ', message);
            const {type, name, args} = JSON.parse(message);
            if (type !== 'FsEvent') return;
            fs[name](...args)
                .then(data => fs.loadTextFile(args[0]))
                .then(data => console.log('data:', data))
                .catch(err => {
                    console.log('err: ', err)
                    ws.send(JSON.stringify(err))
                });
        })
    })
}

const memory = new MemoryFileSystem()

wsOverFs(memory);


// memory.saveFile('a.txt', 'content')






