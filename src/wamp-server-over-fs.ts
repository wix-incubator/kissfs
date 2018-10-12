import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemAsyncMethods, fileSystemEventNames, isDisposable} from './api';
import {wampRealm, wampRealmPrefix} from './constants';

import WampServer from 'wamp-server';

export interface WampFsServer {
    router: {
        close(): void
    },
    connection: Connection
};

export function wampServerOverFs(fs: FileSystem, port = 3000): Promise<WampFsServer> {
    return new Promise<WampFsServer>(resolve => {
        const router = new WampServer({
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
