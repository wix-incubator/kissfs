import * as Promise from 'bluebird';
import {FileSystem, Directory} from "./api";
import {InternalEventsEmitter, makeEventsEmitter} from "./utils";

const timeOutMessage = 'time is out';

export default class ClientFileSystem implements FileSystem {
    public readonly events: InternalEventsEmitter = makeEventsEmitter();
    private reqId: number;

    constructor(
        private ws: WebSocket,
        private readonly timeOut: number = 2000
    ) {
        this.ws.onmessage = message => {
            const eventData = JSON.parse(message.data);
            if (eventData.type === 'error') return console.error(eventData.error);
            this.events.emit(eventData.type, eventData);
        }
    }

    public baseUrl = ''

    saveFile(fullPath:string, newContent:string): Promise<void> {
        const id = String(this.reqId++);

        return new Promise((resolve, reject) => {
            const timeOutId = setTimeout(() => reject(new Error(timeOutMessage)), this.timeOut);
            this.events.once(id, data => {
                console.log('event: ', id, data);
                clearTimeout(timeOutId);
                resolve();
            });

            this.ws.send(JSON.stringify({
                id,
                type: 'FsEvent',
                name: 'saveFile',
                args: [fullPath, newContent]
            }))
        }).then(() => {});
    }

    deleteFile(fullPath:string): Promise<void> {
        return Promise.resolve()
    }

    deleteDirectory(fullPath: string, recursive?: boolean): Promise<void> {
        return Promise.resolve()
    }

    ensureDirectory(fullPath:string): Promise<void> {
        return Promise.resolve()
    }

    loadTextFile(fullPath): Promise<string>{
        return Promise.resolve('a')
    }

    loadDirectoryTree (): Promise<Directory> {
        const f: Directory = {
            type: 'dir',
            name: '',
            fullPath: '',
            children: []
        };
        return Promise.resolve(f)
    }
}
