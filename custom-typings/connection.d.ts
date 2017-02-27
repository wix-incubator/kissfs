declare module "connection" {
    import {Connection} from '@types/autobahn';

    export class WampConnection extends Connection {
        isConnected: boolean
    }
}
