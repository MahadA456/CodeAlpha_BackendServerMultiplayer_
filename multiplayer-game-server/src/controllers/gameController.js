// src/controllers/gameController.js
const games = {}; // This will store game state

const startGame = (req, res) => {
    const gameId = Date.now().toString(); // Simple unique ID
    games[gameId] = { players: [], state: 'waiting for players' };
    res.json({ message: 'Game started', gameId: gameId });
};

const makeMove = (req, res) => {
    const { gameId, player, move } = req.body;
    const game = games[gameId];
    if (game) {
        game.players.push({ player, move }); // Record move
        res.json({ message: `Move accepted for player ${player}` });
    } else {
        res.status(404).send('Game not found');
    }
};

module.exports = { startGame, makeMove };
