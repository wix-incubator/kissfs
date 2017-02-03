import {EventEmitter} from 'eventemitter3';
import * as Promise from 'bluebird';
import {expect} from 'chai';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {FileSystem} from '../src/api';
import {MemoryFileSystem} from '../src/memory-fs';
import wampServerOverFs from '../src/wamp-server-over-fs';
import {WampServer, WampRouter, wampRealm} from '../src/wamp-server-over-fs';
import WampClientFileSystem from '../src/wamp-client-fs';
import {assertFileSystemContract} from './implementation-suite'

describe(`the wamp client filesystem implementation`, () => {

    let wampRouter: WampRouter;
    let port = 3000;
    let connection;

    function server(): Promise<WampServer> {
        return wampServerOverFs(new MemoryFileSystem());
    }

    function getFS(): Promise<FileSystem> {
        return new WampClientFileSystem(`ws://127.0.0.1:${port}/`, wampRealm).init();
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        interval: 1,
        noExtraEventsGrace: 10,
        timeout: 30
    };
    let testLen: number;
    beforeEach(() => server().then(serverAndClient => {
        console.log('BEFORE EACH');
        testLen = Date.now()
        wampRouter = serverAndClient.router
        connection = serverAndClient.connection
    }).catch(e => console.log('EEE:', e)));

    afterEach(() => {
        console.log('SERVER CLOSE');
        connection.close();
        wampRouter.close();
    });

    assertFileSystemContract(getFS, eventMatcherOptions);
});
