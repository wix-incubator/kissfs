import {Server} from 'ws'

const wss = new Server({port: 3000});
wss.on('connection', ws => {
    ws.on('message', message => console.log('received: %s', message));
    ws.send('server: something');
});
