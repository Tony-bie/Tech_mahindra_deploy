const ws = new WebSocket(process.env.WS_API_URL || 'http://localhost:8081');

export default ws;