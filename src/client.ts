const ws = new WebSocket('ws://localhost:3000')

// ws.onmessage = message => console.log(JSON.stringify(message.data))
ws.onmessage = message => console.log(JSON.stringify(message.data))
ws.onopen = () => {
    ws.send(JSON.stringify({
        type: 'FsEvent',
        name: 'saveFile',
        args: ['a.txt', 'content']
    }))
}
