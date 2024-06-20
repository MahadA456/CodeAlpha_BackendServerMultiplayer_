// src/app.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const app = express();
const server = http.createServer(app);

// Static files setup
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket server setup
const wss = new WebSocket.Server({ server });
const players = {};

wss.on('connection', function(ws) {
    console.log('Client connected');
    const playerId = Date.now().toString();
    players[playerId] = { x: 0, y: 0 };
    
    ws.send(JSON.stringify({ type: 'welcome', id: playerId, players }));

    ws.on('message', function(message) {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'move':
                if (players[data.id]) {
                    players[data.id].x += data.dx;
                    players[data.id].y += data.dy;
                    broadcast({ type: 'update', id: data.id, x: players[data.id].x, y: players[data.id].y });
                }
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        delete players[playerId];
        broadcast({ type: 'remove', id: playerId });
    });

    function broadcast(message) {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
});

server.listen(3000, () => {
    console.log('Server started on port 3000');
});
