import * as Promise from 'bluebird';
import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemEventNames, fsMethods} from './api';

const Router = require('wamp-server');

export type WampServer = {
    router: WampRouter,
    connection: Connection
};

export type WampRouter = {
    close: void
};

export const wampRealmPrefix = 'com.kissfs.';
export const wampRealm = `${wampRealmPrefix}driver`;

export default function wampServerOverFs(fs: FileSystem, port = 3000): Promise<WampServer> {
    return new Promise<WampServer>(resolve => {
        const router: WampRouter = new Router({
            port,
            realms: [wampRealm]
        });

        const connection: Connection = new Connection({
            realm: wampRealm,
            url: `ws://127.0.0.1:${port}/`,
        });

        connection.onopen = (session: Session) => {
            fileSystemEventNames.forEach(fsEvent => {
                fs.events.on(fsEvent, data => session.publish(`${wampRealmPrefix}${fsEvent}`, [data]));
            });

            fsMethods.forEach(ev => {
                session.register(`${wampRealmPrefix}${ev}`, (data: string[]) => fs[ev](...data).then(res => res));
            });

            resolve({router, connection});
        };

        connection.open();
    });
}
