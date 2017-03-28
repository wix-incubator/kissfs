import {EventEmitter} from 'eventemitter3';
import * as Promise from 'bluebird';
import * as retry from 'bluebird-retry';
import {expect} from 'chai';
import {WampServer, WampRouter, wampRealm, wampServerOverFs} from '../src/nodejs';
import {FileSystem, WampClientFileSystem, MemoryFileSystem} from '../src/universal';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {assertFileSystemContract, ignoredDir, ignoredFile} from './implementation-suite'

describe(`the wamp client filesystem implementation`, () => {

    let wampServer: WampServer;

    function server(): Promise<WampServer> {
        return wampServerOverFs(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]), 3000);
    }

    function getFS(): Promise<FileSystem> {
        return new WampClientFileSystem(`ws://127.0.0.1:3000`, wampRealm).init();
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        interval: 50,
        noExtraEventsGrace: 150,
        timeout: 1500
    };

    beforeEach(() => server().then(clientAndServer => wampServer = clientAndServer));

    afterEach(() => {
        return new Promise(resolve => {
            wampServer.router.close();
            const errMsg = `WAMP connection hasn't been closed after the previous test`;
            return retry(
                () => (wampServer.connection as any).isConnected ? Promise.reject(errMsg) : Promise.resolve(),
                {interval: 100, max_tries: 10}
            ).then(() => resolve())
        });
    });

    assertFileSystemContract(getFS, eventMatcherOptions);
});
