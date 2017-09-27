import {expect} from 'chai';
import {retryPromise} from '../src/promise-utils';
import {WampServer, wampRealm, wampServerOverFs} from '../src/nodejs';
import {WampClientFileSystem, MemoryFileSystem} from '../src/universal';
import {noConnectionError} from '../src/wamp-client-fs';
import {EventsMatcher} from '../test-kit/drivers/events-matcher';
import {
    assertFileSystemContract,
    ignoredDir,
    ignoredFile,
    fileName,
    dirName,
    content
} from './implementation-suite'

describe(`the wamp client filesystem implementation`, () => {

    let wampServer: WampServer;

    function server(): Promise<WampServer> {
        return wampServerOverFs(new MemoryFileSystem(undefined, [ignoredDir, ignoredFile]), 3000);
    }

    function getFS(): Promise<WampClientFileSystem> {
        return Promise.resolve(new WampClientFileSystem(`ws://127.0.0.1:3000`, wampRealm));
    }

    function getInitedFS(): Promise<WampClientFileSystem> {
        return getFS().then(fs => fs.init());
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
            return retryPromise(
                () => (wampServer.connection as any).isConnected ? Promise.reject(errMsg) : Promise.resolve(),
                {interval: 100, retries: 10}
            ).then(() => resolve())
        });
    });

    assertFileSystemContract(getInitedFS, eventMatcherOptions);

    describe(`when not inited`, () => {
        it(`fails on each CRUD method`, () => {
            return Promise.all([
                expect(getFS().then(fs => fs.saveFile(fileName, content))).to.eventually.be.rejectedWith(noConnectionError),
                expect(getFS().then(fs => fs.deleteFile(fileName))).to.eventually.be.rejectedWith(noConnectionError),
                expect(getFS().then(fs => fs.deleteDirectory(dirName))).to.eventually.be.rejectedWith(noConnectionError),
                expect(getFS().then(fs => fs.ensureDirectory(dirName))).to.eventually.be.rejectedWith(noConnectionError),
                expect(getFS().then(fs => fs.loadTextFile(fileName))).to.eventually.be.rejectedWith(noConnectionError),
                expect(getFS().then(fs => fs.loadDirectoryTree())).to.eventually.be.rejectedWith(noConnectionError)
            ]);

        });
    });
});
