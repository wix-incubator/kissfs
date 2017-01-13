import * as Promise from 'bluebird';
import {Connection, Session} from 'autobahn';
import {FileSystem, fileSystemEventNames, Directory} from './api';
import {InternalEventsEmitter, makeEventsEmitter} from "./utils";

export default class WAMPClientFileSystem implements FileSystem {
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


    init(): Promise<WAMPClientFileSystem> {
        const {baseUrl, initTimeout, connection} = this
        return new Promise<WAMPClientFileSystem>((resolve, reject) => {
            connection.open();
            connection.onopen = (session: Session) => {
                this.session = session;
                this.realmPrefix = this.getRealmPrefix();
                fileSystemEventNames.forEach(fsEvent => {
                    this.session.subscribe(`${this.realmPrefix}.${fsEvent}`, data => console.log(data))
                });
                return resolve(this)
            };
        }).timeout(
            initTimeout,
            `Cant't open connection to the WAMP server at ${baseUrl} for ${initTimeout}ms.`
        );
    }

    private getRealmPrefix() { // TODO: refactor this to simple regexp
        let realmPrefix = this.realm.split('.');
        realmPrefix.pop();
        return realmPrefix.join('.');
    }

    saveFile(fullPath:string, newContent:string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.session.call(`${this.realmPrefix}.saveFile`, [fullPath, newContent])
                .then(() => resolve())
                .catch(error => reject(error))
        });
    }

    deleteFile(fullPath:string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.session.call(`${this.realmPrefix}.deleteFile`, [fullPath])
                .then(() => resolve())
                .catch(error => reject(error))
        });
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.session.call(`${this.realmPrefix}.deleteDirectory`, [fullPath])
                .then(() => resolve())
                .catch(error => reject(error))
        });
    }

    ensureDirectory(fullPath:string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.session.call(`${this.realmPrefix}.ensureDirectory`, [fullPath])
                .then(() => resolve())
                .catch(error => reject(error))
        });
    }

    loadTextFile(fullPath): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            return this.session.call(`${this.realmPrefix}.loadTextFile`, [fullPath])
                .then((content: string) => {
                    console.log('loadTextFile', content)
                    return resolve(content)
                })
                .catch(error => reject(error))
        });
    }

    loadDirectoryTree(): Promise<Directory> {
        return new Promise<Directory>((resolve, reject) => {
            return this.session.call(`${this.realmPrefix}.loadDirectoryTree`)
                .then((tree: Directory) => resolve(tree))
                .catch(error => reject(error))
        });
    }
}

