import {Connection, Session} from 'autobahn';
import {Correlation, FileSystem, fileSystemEventNames} from './api';
import {InternalEventsEmitter, makeCorrelationId, makeEventsEmitter} from "./utils";
import {timeoutPromise} from './promise-utils';
import {Directory, File, ShallowDirectory, SimpleStats} from "./model";

export const noConnectionError = `WampClientFileSystem hasn't opened connection yet (forgot to init()?).`

export class WampClientFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private connection: Connection;
    private session?: Session;
    private realmPrefix?: string;

    constructor(public baseUrl: string, private realm: string, private initTimeout: number = 5000) {
        this.realm = realm;
        this.connection = new Connection({url: baseUrl, realm});
    }

    init(): Promise<WampClientFileSystem> {
        const {baseUrl, initTimeout, connection} = this
        return timeoutPromise(new Promise<WampClientFileSystem>(resolve => {
            connection.open();
            connection.onopen = (session: Session) => {
                this.session = session;
                this.realmPrefix = this.realm.replace(/(.*\..*)(\..*)$/, '$1.'); // 'xxx.yyy.zzz' => 'xxx.yyy.'
                fileSystemEventNames.forEach(fsEvent => {
                    session.subscribe(
                        this.realmPrefix + fsEvent,
                        res => this.events.emit(fsEvent, res && res[0])
                    )
                });
                resolve(this)
            };
        }), initTimeout, `Cant't open connection to the WAMP server at ${baseUrl} for ${initTimeout}ms.`);
    }

    // TODO: continue using this.request for implementations
    private async request<T = Correlation>(method:string, ...args : any[]):Promise<T>{
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<T>(this.realmPrefix + method, args);
        } catch (error) {
            throw new Error(error);
        }
    }

    async saveFile(fullPath: string, newContent: string, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        return this.request('saveFile', fullPath, newContent, correlation);
    }

    async deleteFile(fullPath: string, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Correlation>(`${this.realmPrefix}deleteFile`, [fullPath, correlation]);
        } catch (error) {
            throw new Error(error);
        }
    }

    async deleteDirectory(fullPath: string, recursive?: boolean, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Correlation>(`${this.realmPrefix}deleteDirectory`, [fullPath, recursive, correlation]);
        } catch (error) {
            throw new Error(error);
        }
    }

    async ensureDirectory(fullPath: string, correlation: Correlation = makeCorrelationId()): Promise<Correlation> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Correlation>(`${this.realmPrefix}ensureDirectory`, [fullPath, correlation]);
        } catch (error) {
            throw new Error(error);
        }
    }

    async loadTextFile(fullPath: string): Promise<string> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<string>(`${this.realmPrefix}loadTextFile`, [fullPath]);
        } catch (error) {
            throw new Error(error);
        }
    }

    async loadDirectoryTree(fullPath: string = ''): Promise<Directory> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Directory>(`${this.realmPrefix}loadDirectoryTree`, [fullPath]);
        } catch (error) {
            throw new Error(error);
        }
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<(File | ShallowDirectory)[]>(`${this.realmPrefix}loadDirectoryChildren`, [fullPath]);
        } catch (error) {
            throw new Error(error);
        }
    }

    async stat(fullPath: string): Promise<SimpleStats> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<SimpleStats>(`${this.realmPrefix}stat`, [fullPath]);
        } catch (error) {
            throw new Error(error);
        }
    }

    dispose() {
        this.connection && this.connection.close();
    }
}

