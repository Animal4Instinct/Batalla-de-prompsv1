const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  player1: {
    type: String,
    required: false,
  },
  player2: {
    type: String,
    default: null,
  },
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true,
  },
  images: [{
    player: String,
    imageUrl: String
  }],
  winner: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['waiting', 'in-progress', 'voting', 'completed'],
    default: 'waiting',
  },
  gameTime: {
    type: Number, // Tiempo en minutos
    default: 3,   // Valor por defecto
  },
  imageCount: {
    type: Number, // Cantidad de imágenes
    default: 1,   // Valor por defecto
  },
  votingMode: {
    type: String,
    enum: ['public', 'admin'],
    default: 'admin',
  },
  startTime: {
    type: Date,
    default: null,
  },
  endTime: {
    type: Date,
    default: null,
  },
  votingEndTime: {
    type: Date,
    default: null,
  },
  voters: [String], // Para almacenar IPs de votantes si es necesario
  spectators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const Game = mongoose.model('Game', GameSchema);

GameSchema.index({ status: 1 });
GameSchema.index({ topic: 1 });

module.exports = Game;
