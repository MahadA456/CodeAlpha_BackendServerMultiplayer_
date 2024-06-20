// src/controllers/gameController.js
const startGame = (req, res) => {
    // Start game logic here
    res.send('Game started successfully!');
};

const makeMove = (req, res) => {
    // Move making logic here
    res.send('Move made successfully!');
};

module.exports = {
    startGame,
    makeMove
};
