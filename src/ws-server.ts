import * as Promise from 'bluebird';
import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemEventNames, fsMethods} from './api';
import {MemoryFileSystem} from './memory-fs';

const Server = require('wamp-server');

function wsOverFs(fs: FileSystem, port = 3000) {
    const server = new Server({
        port,
        realms: ['com.kissfs.driver']
    });

    const connection = new Connection({
        realm: 'com.kissfs.driver',
        url: 'ws://127.0.0.1:3000/',
    });

    connection.onopen = (session: Session) => {
        fileSystemEventNames.forEach(fsEvent => {
            fs.events.on(fsEvent, data => session.publish(`com.kissfs.${fsEvent}`, [data]))
        })

        fsMethods.forEach(ev => {
            session.register(`com.kissfs.${ev}`, (data: string[]) => fs[ev](...data).then(res => res));
        })
    };

    connection.open();
}

wsOverFs(new MemoryFileSystem());
