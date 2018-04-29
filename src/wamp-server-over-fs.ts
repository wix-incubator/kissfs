import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemAsyncMethods, fileSystemEventNames, isDisposable} from './api';
import {wampRealm, wampRealmPrefix} from './constants';

const Router = require('wamp-server');

export type WampServer = {
    router: WampRouter,
    connection: Connection
};

export type WampRouter = {
    close: () => void
};

export function wampServerOverFs(fs: FileSystem, port = 3000): Promise<WampServer> {
    return new Promise<WampServer>(resolve => {
        const router: WampRouter = new Router({
            port,
            realms: [wampRealm]
        });

        const connection = new Connection({
            realm: wampRealm,
            url: `ws://127.0.0.1:${port}/`,
        });

        connection.onopen = (session: Session) => {
            fileSystemEventNames.forEach(fsEvent => {
                fs.events.on(fsEvent, data => session.isOpen && session.publish(`${wampRealmPrefix}${fsEvent}`, [data]));
            });

            fileSystemAsyncMethods.forEach(ev => {
                session.register(`${wampRealmPrefix}${ev}`,
                    async (data: any[] = []) => (fs as any)[ev](...data).catch((e: Error) => Promise.reject(e.message)));
            });

            resolve({
                router,
                connection
            });
        };

        connection.onclose = (_reason, details) => {
            if (!details.will_retry && isDisposable(fs)) {
                fs.dispose();
            }
            return details.will_retry;
        };

        connection.open();
    });
}
