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

    function server(): Promise<WampServer> {
        return wampServerOverFs(new MemoryFileSystem());
    }

    function getFS(): Promise<FileSystem> {
        return new WampClientFileSystem(`ws://127.0.0.1:3000/`, wampRealm).init();
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        interval: 50,
        noExtraEventsGrace: 150,
        timeout: 1500
    };

    beforeEach(() => server().then(serverAndClient => wampRouter = serverAndClient.router));

    afterEach(() => {
        return new Promise(resolve => {
            wampRouter.close();
            resolve();
        });
    });

    assertFileSystemContract(getFS, eventMatcherOptions);
});
