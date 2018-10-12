import {Connection, Session} from 'autobahn';
import {Correlation, FileSystem, fileSystemEventNames} from './api';
import {InternalEventsEmitter, makeEventsEmitter} from './utils';
import {timeoutPromise} from './promise-utils';
import {Directory, File, ShallowDirectory, SimpleStats} from './model';

export const noConnectionError = `WampClientFileSystem hasn't opened connection yet (forgot to init()?).`;

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
        const {baseUrl, initTimeout, connection} = this;
        return timeoutPromise(new Promise<WampClientFileSystem>(resolve => {
            connection.open();
            connection.onopen = (session: Session) => {
                this.session = session;
                this.realmPrefix = this.realm.replace(/(.*\..*)(\..*)$/, '$1.'); // 'xxx.yyy.zzz' => 'xxx.yyy.'
                fileSystemEventNames.forEach(fsEvent => {
                    session.subscribe(
                        this.realmPrefix + fsEvent,
                        res => this.events.emit(fsEvent, res && res[0])
                    );
                });
                resolve(this);
            };
        }), initTimeout, `Cant't open connection to the WAMP server at ${baseUrl} for ${initTimeout}ms.`);
    }

    async saveFile(fullPath: string, newContent: string, correlation?: Correlation): Promise<Correlation>;
    async saveFile(...args: any[]): Promise<Correlation> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Correlation>(`${this.realmPrefix}saveFile`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    async deleteFile(fullPath: string, correlation?: Correlation): Promise<Correlation>;
    async deleteFile(...args: any[]): Promise<Correlation> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Correlation>(`${this.realmPrefix}deleteFile`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    async deleteDirectory(fullPath: string, recursive?: boolean, correlation?: Correlation): Promise<Correlation>;
    async deleteDirectory(...args: any[]): Promise<Correlation> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Correlation>(`${this.realmPrefix}deleteDirectory`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    async ensureDirectory(fullPath: string, correlation?: Correlation): Promise<Correlation>;
    async ensureDirectory(...args: any[]): Promise<Correlation> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Correlation>(`${this.realmPrefix}ensureDirectory`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    async loadTextFile(fullPath: string): Promise<string>;
    async loadTextFile(...args: any[]): Promise<string> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<string>(`${this.realmPrefix}loadTextFile`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    async loadDirectoryTree(fullPath?: string): Promise<Directory>;
    async loadDirectoryTree(...args: any[]): Promise<Directory> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<Directory>(`${this.realmPrefix}loadDirectoryTree`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    async loadDirectoryChildren(fullPath: string): Promise<(File | ShallowDirectory)[]>;
    async loadDirectoryChildren(...args: any[]): Promise<(File | ShallowDirectory)[]> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<(File | ShallowDirectory)[]>(`${this.realmPrefix}loadDirectoryChildren`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    async stat(fullPath: string): Promise<SimpleStats>;
    async stat(...args: any[]): Promise<SimpleStats> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<SimpleStats>(`${this.realmPrefix}stat`, args);
        } catch (error) {
            throw new Error(error.args[0]);
        }
    }

    dispose() {
        this.connection && this.connection.close();
    }
}

