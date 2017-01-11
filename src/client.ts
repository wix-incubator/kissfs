import ClientFileSystem from './client-fs'

const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
    const fs = new ClientFileSystem(ws)
    fs
        .saveFile('a.txt', 'my content')
        .then(
            res => console.log('res: ', res),
            err => console.log('err: ', err)
        )
}


