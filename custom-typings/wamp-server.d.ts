declare module 'wamp-server' {
    interface ServerOptions {
        port: number
        realms: string[]
    }

    class Server {
        constructor(options: ServerOptions)
        close(): void
    }

    export = Server
}