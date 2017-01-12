import * as Promise from 'bluebird';
import {Connection, Session} from 'autobahn';
import {FileSystem} from './api';
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

        // console.log(session)
        session.register('com.kissfs.test', data => {
            console.log('com.kissfs.test', data);
            return {test: data}
        })
        // session.subscribe('com.kissfs.test', )
    };

    connection.open();





    // ['fileCreated', 'fileChanged', 'fileDeleted', 'directoryCreated', 'directoryDeleted']
    //     .forEach(ev => fs.events.on(ev as any, data => server.publish(data))

    // wss.on('connection', ws => {
    //     ws.on('message', message => {
    //         const {type, id, name, args} = JSON.parse(message);
    //         if (type !== 'FsEvent') return;
    //         fs[name](...args)
    //             .then(fsResponse => {
    //                 ws.send(JSON.stringify({
    //                     id,
    //                     type: 'FsEvent',
    //                     data: fsResponse
    //                 }))
    //             })
    //             .catch(error => ws.send(JSON.stringify({type: 'error', error})));
    //     })
    // })
}

wsOverFs(new MemoryFileSystem());
