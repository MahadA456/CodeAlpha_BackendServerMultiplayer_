// src/utils/websocket.js
const WebSocket = require('ws');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.wss.on('connection', this.onConnection.bind(this));
    }

    onConnection(ws) {
        console.log('New client connected.');

        ws.on('message', this.onMessage.bind(this, ws));
        ws.on('close', () => this.onClose(ws));
        ws.on('error', error => this.onError(ws, error));

        // Send a welcome message to the client
        ws.send(JSON.stringify({ message: 'Welcome to the WebSocket server!' }));
    }

    onMessage(ws, message) {
        console.log(`Received message: ${message}`);
        try {
            const data = JSON.parse(message);
            if (data.action === 'start') {
                console.log('Start game action received');
                ws.send(JSON.stringify({ message: 'Game started successfully!' }));
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
            ws.send(JSON.stringify({ error: 'Error processing your message.' }));
        }
    }

    onClose(ws) {
        console.log('Client disconnected.');
    }

    onError(ws, error) {
        console.error('WebSocket error:', error);
    }
}

module.exports = WebSocketServer;
