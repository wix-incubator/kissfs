import * as Promise from 'bluebird';
import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemEventNames, fsMethods} from './api';
import {wampRealm} from './utils';

const Server = require('wamp-server');
export type WampServerAndClient = {
    server: WampServer,
    client: Connection
}

export type WampServer = {
    close: void
}

export default function wampServerOverFs(fs: FileSystem, port = 3000): Promise<WampServerAndClient> {
    return new Promise<WampServerAndClient>(resolve => {
        const server: WampServer = new Server({
            port,
            realms: [wampRealm]
        });

        const connection: Connection = new Connection({
            realm: wampRealm,
            url: `ws://127.0.0.1:${port}/`,
        });

        connection.onopen = (session: Session) => {
            fileSystemEventNames.forEach(fsEvent => {
                fs.events.on(fsEvent, data => session.publish(`com.kissfs.${fsEvent}`, [data]))
            })

            fsMethods.forEach(ev => {
                session.register(`com.kissfs.${ev}`, (data: string[]) => fs[ev](...data).then(res => res));
            });

            resolve({
                server: server,
                client: connection
            })
        };

        connection.open();
    })
}
