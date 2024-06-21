// src/app.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket server setup
const wss = new WebSocket.Server({ server });
const players = {};
const items = generateItems();
const obstacles = generateObstacles();
const projectiles = [];
let nextPlayerId = 1;
let gameTimer;

function generateItems() {
    let items = [];
    for (let i = 0; i < 10; i++) {
        items.push({ x: Math.random() * 780, y: Math.random() * 580 });
    }
    return items;
}

function generateObstacles() {
    let obstacles = [];
    for (let i = 0; i < 5; i++) {
        obstacles.push({ x: Math.random() * 780, y: Math.random() * 580, width: 50, height: 50 });
    }
    return obstacles;
}

wss.on('connection', function(ws) {
    console.log('Client connected');
    const playerId = nextPlayerId++;
    players[playerId] = { x: Math.random() * 780, y: Math.random() * 580, health: 3, score: 0, id: playerId, color: playerId === 1 ? 'red' : 'blue' };

    if (!gameTimer) {
        startGameTimer();
    }

    ws.send(JSON.stringify({ type: 'welcome', id: playerId, players, items, obstacles }));

    ws.on('message', function(message) {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'move':
                if (players[data.id]) {
                    players[data.id].x += data.dx;
                    players[data.id].y += data.dy;
                    checkItemCollision(data.id);
                    checkObstacleCollision(data.id);
                    broadcast({ type: 'update', id: data.id, x: players[data.id].x, y: players[data.id].y, score: players[data.id].score });
                }
                break;
            case 'shoot':
                if (players[data.id]) {
                    const projectile = { x: players[data.id].x, y: players[data.id].y, dx: data.dx, dy: data.dy, owner: data.id };
                    projectiles.push(projectile);
                    broadcast({ type: 'projectile', projectile });
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

    function checkItemCollision(playerId) {
        const player = players[playerId];
        items.forEach((item, index) => {
            if (Math.abs(player.x - item.x) < 20 && Math.abs(player.y - item.y) < 20) {
                player.score += 1;
                items.splice(index, 1);
                broadcast({ type: 'removeItem', index });
                broadcast({ type: 'updateScore', id: playerId, score: player.score });
            }
        });
    }

    function checkObstacleCollision(playerId) {
        const player = players[playerId];
        obstacles.forEach(obstacle => {
            if (
                player.x < obstacle.x + obstacle.width &&
                player.x + 20 > obstacle.x &&
                player.y < obstacle.y + obstacle.height &&
                player.y + 20 > obstacle.y
            ) {
                player.health -= 1;
                if (player.health <= 0) {
                    broadcast({ type: 'gameOver', winner: playerId === 1 ? 2 : 1 });
                }
                broadcast({ type: 'updateHealth', id: playerId, health: player.health });
            }
        });
    }

    function startGameTimer() {
        let timeLeft = 30;
        gameTimer = setInterval(() => {
            timeLeft -= 1;
            broadcast({ type: 'timer', timeLeft });

            if (timeLeft <= 0) {
                clearInterval(gameTimer);
                gameTimer = null;
                const scores = Object.values(players).map(player => ({ id: player.id, score: player.score }));
                broadcast({ type: 'gameOver', scores });
            }
        }, 1000);
    }
});

server.listen(3000, () => {
    console.log('Server started on port 3000');
});
