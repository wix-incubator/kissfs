import * as Promise from 'bluebird';
import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemEventNames, fileSystemMethods} from './api';
const Router = require('wamp-server');

export type WampServer = {
    router: WampRouter,
    connection: Connection,
    isConnectionClosed: () => boolean
};

export type WampRouter = {
    close: () => void
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

        console.log('AFTER CONNECTION');

        let isConnectionClosed = true;
        connection.onopen = (session: Session) => {
            isConnectionClosed = false;
            console.log('ON OPEN, SESSION:', Boolean(session));
            fileSystemEventNames.forEach(fsEvent => {
                fs.events.on(fsEvent, data => session.publish(`${wampRealmPrefix}${fsEvent}`, [data]));
            });
            console.log('BOUND fileSystemEventNames');
            fileSystemMethods.forEach(ev => {
                session.register(`${wampRealmPrefix}${ev}`, (data: string[]) => fs[ev](...data).then(res => res));
            });
            console.log('REGISTERED fileSystemMethods');

            resolve({
                router,
                connection,
                isConnectionClosed: () => isConnectionClosed
            });
        };

        connection.onclose = (reason, details) => {
            isConnectionClosed = true;
            console.log('CLOSED CALLBACK');
            return false;
        }

        connection.open();
    });
}
