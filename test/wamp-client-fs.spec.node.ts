import { expect } from 'chai';
import { retryPromise } from '../src/promise-utils';
import { wampRealm, WampServer, wampServerOverFs } from '../src/nodejs';
import { MemoryFileSystem, WampClientFileSystem } from '../src/universal';
import { noConnectionError } from '../src/wamp-client-fs';
import { EventsMatcher } from './events-matcher';
import { assertFileSystemContract } from './implementation-suite'
import { fileSystemAsyncMethods } from "../src/api";
import { spy } from 'sinon';

const msg = 'foo';
const fakeArgs = ['foo', 'bar'];

describe(`the wamp client filesystem proxy`, () => {
    let wampServer: WampServer;
    let underlyingFs: MemoryFileSystem;

    function server(): Promise<WampServer> {
        underlyingFs = new MemoryFileSystem();
        return wampServerOverFs(underlyingFs, 3000);
    }

    async function getFS(): Promise<WampClientFileSystem> {
        return new WampClientFileSystem(`ws://127.0.0.1:3000`, wampRealm);
    }

    async function getInitedFS(): Promise<WampClientFileSystem> {
        const fs = await getFS();
        return fs.init();
    }

    const eventMatcherOptions: EventsMatcher.Options = {
        retries: 25,
        interval: 50,
        noExtraEventsGrace: 150,
        timeout: 1500
    };

    beforeEach(async () => {
        wampServer = await server();
    });

    afterEach(() => {
        wampServer.router.close();
        const errMsg = `WAMP connection hasn't been closed after the previous test`;
        return retryPromise(
            () => (wampServer.connection as any).isConnected ? Promise.reject(errMsg) : Promise.resolve(),
            { interval: 100, retries: 10 }
        );
    });

    fileSystemAsyncMethods.forEach(asyncMethodName => {
        describe(`${asyncMethodName} method`, () => {
            let fs: WampClientFileSystem | undefined

            afterEach(() => {
                if (fs) {
                    fs.dispose();
                }
            });

            it(`fails when not inited`, async () => {
                const withoutInit = await getFS()
                return expect((withoutInit[asyncMethodName] as Function)(...fakeArgs)).to.eventually.be.rejectedWith(noConnectionError);
            });

            it(`passes arguments and results correctly`, async () => {
                fs = await getInitedFS();
                let methodImpl = spy(async () => msg);
                (underlyingFs as any)[asyncMethodName] = methodImpl;
                const res = await (fs[asyncMethodName] as Function)(...fakeArgs);
                expect(res).to.eql(msg);
                expect(methodImpl).to.have.been.calledWith(...fakeArgs);
            });

            it(`reports original error messages`, async () => {
                fs = await getInitedFS();
                (underlyingFs as any)[asyncMethodName] = async () => {
                    throw new Error(msg)
                };
                await expect((fs[asyncMethodName] as Function)(...fakeArgs)).to.eventually.be.rejectedWith(msg);
            });
        });
    });

    assertFileSystemContract(getInitedFS, eventMatcherOptions);
});
