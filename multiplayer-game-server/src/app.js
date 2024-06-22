const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = {};
const items = generateItems();
const obstacles = generateObstacles();
const projectiles = [];
const powerUps = generatePowerUps();
const waitingPlayers = [];
let nextPlayerId = 1;
let gameTimer;
const JWT_SECRET = 'your_jwt_secret_key';  // Use a secure key in production

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// User database (in-memory for simplicity)
const users = [];

// Generate items, obstacles, and power-ups
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

function generatePowerUps() {
    let powerUps = [];
    for (let i = 0; i < 5; i++) {
        powerUps.push({ x: Math.random() * 780, y: Math.random() * 580, type: 'speed' });  // Example power-up type
    }
    return powerUps;
}

// Authentication routes
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (users.find(user => user.username === username)) {
        return res.status(400).send('Username already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword });
    res.status(201).send('User registered');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(user => user.username === username);
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).send('Invalid credentials');
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// WebSocket connection
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'authenticate':
                authenticatePlayer(ws, data.token);
                break;
            case 'move':
                movePlayer(data);
                break;
            case 'shoot':
                shootProjectile(data);
                break;
            case 'chat':
                handleChat(data);
                break;
        }
    });

    ws.on('close', () => {
        removePlayer(ws);
    });
});

function authenticatePlayer(ws, token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const playerId = nextPlayerId++;
        players[playerId] = { id: playerId, username: payload.username, x: Math.random() * 780, y: Math.random() * 580, health: 3, score: 0, color: playerId % 2 === 0 ? 'red' : 'blue', ws };
        waitingPlayers.push(players[playerId]);
        ws.send(JSON.stringify({ type: 'authenticated', playerId }));
        if (waitingPlayers.length >= 2) {
            startMatch(waitingPlayers.shift(), waitingPlayers.shift());
        }
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
    }
}

function startMatch(player1, player2) {
    const gameId = nextPlayerId++;
    player1.gameId = gameId;
    player2.gameId = gameId;
    const gamePlayers = { [player1.id]: player1, [player2.id]: player2 };
    const gameItems = generateItems();
    const gameObstacles = generateObstacles();
    const gamePowerUps = generatePowerUps();
    sendToPlayers(gamePlayers, { type: 'startGame', players: gamePlayers, items: gameItems, obstacles: gameObstacles, powerUps: gamePowerUps });
}

function movePlayer(data) {
    const player = players[data.id];
    if (player) {
        player.x += data.dx;
        player.y += data.dy;
        checkItemCollision(player);
        checkObstacleCollision(player);
        checkPowerUpCollision(player);
        sendToPlayersInGame(player.gameId, { type: 'update', id: player.id, x: player.x, y: player.y, score: player.score });
    }
}

function shootProjectile(data) {
    const player = players[data.id];
    if (player) {
        const projectile = { x: player.x, y: player.y, dx: data.dx, dy: data.dy, owner: player.id };
        projectiles.push(projectile);
        sendToPlayersInGame(player.gameId, { type: 'projectile', projectile });
    }
}

function handleChat(data) {
    sendToPlayersInGame(data.gameId, { type: 'chat', message: data.message, username: data.username });
}

function removePlayer(ws) {
    for (const playerId in players) {
        if (players[playerId].ws === ws) {
            const player = players[playerId];
            delete players[playerId];
            sendToPlayersInGame(player.gameId, { type: 'remove', id: playerId });
            if (waitingPlayers.includes(player)) {
                waitingPlayers.splice(waitingPlayers.indexOf(player), 1);
            }
            break;
        }
    }
}

function checkItemCollision(player) {
    const items = player.gameItems;
    items.forEach((item, index) => {
        if (Math.abs(player.x - item.x) < 20 && Math.abs(player.y - item.y) < 20) {
            player.score += 1;
            items.splice(index, 1);
            sendToPlayersInGame(player.gameId, { type: 'removeItem', index });
            sendToPlayersInGame(player.gameId, { type: 'updateScore', id: player.id, score: player.score });
        }
    });
}

function checkObstacleCollision(player) {
    const obstacles = player.gameObstacles;
    obstacles.forEach(obstacle => {
        if (
            player.x < obstacle.x + obstacle.width &&
            player.x + 20 > obstacle.x &&
            player.y < obstacle.y + obstacle.height &&
            player.y + 20 > obstacle.y
        ) {
            player.health -= 1;
            if (player.health <= 0) {
                sendToPlayersInGame(player.gameId, { type: 'gameOver', winner: player.id === 1 ? 2 : 1 });
            }
            sendToPlayersInGame(player.gameId, { type: 'updateHealth', id: player.id, health: player.health });
        }
    });
}

function checkPowerUpCollision(player) {
    const powerUps = player.gamePowerUps;
    powerUps.forEach((powerUp, index) => {
        if (Math.abs(player.x - powerUp.x) < 20 && Math.abs(player.y - powerUp.y) < 20) {
            if (powerUp.type === 'speed') {
                player.speed += 2;  // Example effect
            }
            powerUps.splice(index, 1);
            sendToPlayersInGame(player.gameId, { type: 'removePowerUp', index });
        }
    });
}

function sendToPlayers(players, message) {
    for (const id in players) {
        players[id].ws.send(JSON.stringify(message));
    }
}

function sendToPlayersInGame(gameId, message) {
    for (const playerId in players) {
        if (players[playerId].gameId === gameId) {
            players[playerId].ws.send(JSON.stringify(message));
        }
    }
}

server.listen(3000, () => {
    console.log('Server started on port 3000');
});
