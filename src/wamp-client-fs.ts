import {Connection, Session} from 'autobahn';
import { File, FileSystem, fileSystemEventNames, Directory, ShallowDirectory} from './api';
import {InternalEventsEmitter, makeEventsEmitter} from "./utils";
import {timeoutPromise} from './promise-utils';

export const noConnectionError = `WampClientFileSystem hasn't opened connection yet (forgot to init()?).`

export class WampClientFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private connection: Connection;
    private session: Session;
    private realmPrefix: string;

    constructor(public baseUrl: string, private realm: string, private initTimeout: number = 5000) {
        this.realm = realm;
        this.connection = new Connection({url: baseUrl, realm});
    }

    init(): Promise<WampClientFileSystem> {
        const {baseUrl, initTimeout, connection} = this
        return timeoutPromise(initTimeout, new Promise<WampClientFileSystem>(resolve => {
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
                return resolve(this)
            };
        }), `Cant't open connection to the WAMP server at ${baseUrl} for ${initTimeout}ms.`);
    }

    saveFile(fullPath:string, newContent:string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.session || !this.session.isOpen) {
                return reject(noConnectionError);
            }
            this.session.call(`${this.realmPrefix}saveFile`, [fullPath, newContent])
                .then(() => resolve())
                .catch(error => reject(new Error(error)))
        });
    }

    deleteFile(fullPath:string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.session || !this.session.isOpen) {
                return reject(noConnectionError);
            }

            this.session.call(`${this.realmPrefix}deleteFile`, [fullPath])
                .then(() => resolve())
                .catch(error => reject(new Error(error)))
        });
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.session || !this.session.isOpen) {
                return reject(noConnectionError);
            }

            this.session.call(`${this.realmPrefix}deleteDirectory`, [fullPath, recursive])
                .then(() => resolve())
                .catch(error => reject(new Error(error)))
        });
    }

    ensureDirectory(fullPath:string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.session || !this.session.isOpen) {
                return reject(noConnectionError);
            }

            this.session.call(`${this.realmPrefix}ensureDirectory`, [fullPath])
                .then(() => resolve())
                .catch(error => reject(new Error(error)))
        });
    }

    loadTextFile(fullPath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (!this.session || !this.session.isOpen) {
                return reject(noConnectionError);
            }

            return this.session.call(`${this.realmPrefix}loadTextFile`, [fullPath])
                .then((content: string) => resolve(content))
                .catch(error => reject(new Error(error)))
        });
    }

    loadDirectoryTree(fullPath:string = ''): Promise<Directory> {
        return new Promise<Directory>((resolve, reject) => {
            if (!this.session || !this.session.isOpen) {
                return reject(noConnectionError);
            }
            return this.session.call(`${this.realmPrefix}loadDirectoryTree`, [fullPath])
                .then((tree: Directory) => resolve(tree))
                .catch(error => reject(new Error(error)))
            });
        }
        
    async loadDirectoryChildren(fullPath:string): Promise<(File | ShallowDirectory)[]> {
        if (!this.session || !this.session.isOpen) {
            throw new Error(noConnectionError);
        }
        try {
            return await this.session.call<(File | ShallowDirectory)[]>(`${this.realmPrefix}loadDirectoryChildren`, [fullPath]);
        } catch (error) {
            throw new Error(error);
        }
    }

    dispose() {
        this.connection && this.connection.close();
    }
}

