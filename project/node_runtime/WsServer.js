const { WebSocketServer, WebSocket } = require('ws')

const server = new WebSocketServer({
    port: 8081
})

server.on('connection', (socket) => {
    console.log('client connected') 

    socket.on('message', (message) => {
        try{
            const mensaje = JSON.parse(message.toString()) 

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
        console.log('client disconnected') 
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err)
    })

    
})

server.on('listening', () => {
    const addr = server.address()
    console.log(addr)
    console.log(`WebSocket server is running on ${process.env.WS_API_URL || 'http://localhost:8081'}`);
})

module.exports = server;