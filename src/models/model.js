const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    player_id: {
        required: false,
        type: String
    },
    name: {
        required: true,
        type: String
    },
    server: {
        required: true,
        type: String
    }, 
    experience: {
        required: true,
        type: Number
    },
    level: {
        required: true,
        type: Number
    }
})

exports.Player = mongoose.model('Player', playerSchema)
exports.playerSchema = playerSchema;