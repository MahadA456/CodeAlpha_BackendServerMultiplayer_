// src/controllers/statsController.js
const getPlayerStats = (req, res) => {
    // Fetch player stats logic here
    res.send(`Stats for player ${req.params.id}`);
};

module.exports = {
    getPlayerStats
};
