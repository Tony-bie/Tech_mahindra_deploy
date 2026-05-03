const { WebSocketServer, WebSocket } = require('ws')

const server = new WebSocketServer({
    port: 8081
})

server.on('connection', (socket) => {
    clients.add(socket)

    socket.on('message', (message) => {
        try{
            const mensaje = JSON.parse(message.toString()) 
            console.log(message)

            server.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(mensaje))
                }
            })

        } catch(error){
            console.error(message.toString())
        }
    })

    socket.on('close', () => {
        clients.delete(socket) 
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err)
        clients.delete(socket)
    })

    
})

server.on('listening', () => {
    const addr = server.address()
    console.log(addr)
    console.log('WebSocket server is running on ws://localhost:8081');
})

