import {Server} from 'ws';
import {FileSystem} from './api';
import {MemoryFileSystem} from './memory-fs';

function broadcast(wss: Server, data) {
    wss.clients.forEach(client => {
        client.send(JSON.stringify(data));
    });
}

function wsOverFs(fs: FileSystem, port = 3000) {
    const wss = new Server({port});

    ['fileCreated', 'fileChanged', 'fileDeleted', 'directoryCreated', 'directoryDeleted']
        .forEach(ev => fs.events.on(ev as any, data => broadcast(wss, data)))

    wss.on('connection', ws => {
        ws.on('message', message => {
            const {type, id, name, args} = JSON.parse(message);
            if (type !== 'FsEvent') return;
            fs[name](...args)
                .then(fsResponse => {
                    ws.send(JSON.stringify({
                        id,
                        type: 'FsEvent',
                        data: fsResponse
                    }))
                })
                .catch(error => ws.send(JSON.stringify({type: 'error', error})));
        })
    })
}

wsOverFs(new MemoryFileSystem());
