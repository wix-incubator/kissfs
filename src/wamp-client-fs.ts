import * as Promise from 'bluebird';
import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemEventNames, Directory} from './api';
import {InternalEventsEmitter, makeEventsEmitter} from "./utils";

export class WampClientFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private connection: Connection;
    private session: Session;
    private realmPrefix: string;
    public baseUrl: string;

    constructor(url, private realm: string, private initTimeout: number = 5000) {
        this.baseUrl = url
        this.realm = realm
        this.connection = new Connection({url, realm});
    }

    init(): Promise<WampClientFileSystem> {
        const {baseUrl, initTimeout, connection} = this
        return new Promise<WampClientFileSystem>(resolve => {
            connection.open();
            connection.onopen = (session: Session) => {
                this.session = session;
                this.realmPrefix = this.realm.replace(/(.*\..*)(\..*)$/, '$1.'); // 'xxx.yyy.zzz' => 'xxx.yyy.'
                fileSystemEventNames.forEach(fsEvent => {
                    this.session.subscribe(
                        this.realmPrefix + fsEvent,
                        res => this.events.emit(fsEvent, res && res[0])
                    )
                });
                resolve(this);
            };
        }).timeout(
            initTimeout,
            `Cant't open connection to the WAMP server at ${baseUrl} for ${initTimeout}ms.`
        );
    }

    saveFile(fullPath:string, newContent:string): Promise<void> {
        return this.session.call(`${this.realmPrefix}saveFile`, [fullPath, newContent]);
    }

    deleteFile(fullPath:string): Promise<void> {
        return this.session.call(`${this.realmPrefix}deleteFile`, [fullPath]);
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return this.session.call(`${this.realmPrefix}deleteDirectory`, [fullPath, recursive]);
    }

    ensureDirectory(fullPath:string): Promise<void> {
        return this.session.call(`${this.realmPrefix}ensureDirectory`, [fullPath]);
    }

    loadTextFile(fullPath): Promise<string> {
        return this.session.call(`${this.realmPrefix}loadTextFile`, [fullPath]);
    }

    loadDirectoryTree(): Promise<Directory> {
        return this.session.call(`${this.realmPrefix}loadDirectoryTree`);
    }
}

