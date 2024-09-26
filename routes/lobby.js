const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Topic = require('../models/Topic');
const ensureAuthenticated = require('../middleware/authMiddleware');
const ensureAdmin = require('../middleware/ensureAdmin');

// Mostrar el lobby
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Obtener todas las partidas excepto las que están en estado 'completed'
    const games = await Game.find({ status: { $ne: 'completed' } }).populate('topic');
    const topics = await Topic.find(); // Obtener todos los topics disponibles
    const user = req.user; // Obtener el usuario autenticado

    // Verifica si se han encontrado temas
    if (!topics || topics.length === 0) {
      console.log('No hay temas disponibles');
    }
    res.render('lobby', { user, games, topics });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Crear una nueva partida
router.post('/new-game', ensureAuthenticated, async (req, res) => {
  try {
    const { gameTime, imageCount, votingMode, playerNick } = req.body;
    
    // Obtener todos los temas disponibles
    const topics = await Topic.find();
    if (topics.length === 0) {
      return res.status(404).send('No hay temas disponibles');
    }

    // Seleccionar un tema aleatorio
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    const game = new Game({
      topic: randomTopic._id,
      status: 'waiting',
      gameTime: Math.min(gameTime, 3), // Limitar el tiempo de juego a un máximo de 3 minutos
      imageCount: Math.min(imageCount, 3), // Limitar la cantidad de imágenes a un máximo de 3
      votingMode: votingMode === 'admin' ? 'admin' : 'public' // Validar el modo de votación
    });

    // Si el creador no es un admin, asignar player1
    if (!req.user.isAdmin) {
      game.player1 = playerNick; // Usar el 'playerNick' proporcionado en el formulario
    } else {
      game.player1 = req.user.nickname; // Usar el nickname del usuario autenticado si es admin
    }

    await game.save();
    res.redirect(`/game/${game._id}`);
  } catch (err) {
    console.error('Error al crear la partida:', err.message);
    res.status(500).send('Error en el servidor');
  }
});


// Unirse a una partida en curso
router.post('/join-game', ensureAuthenticated, async (req, res) => {
  const { gameId, playerNick } = req.body;

  try {
    const game = await Game.findById(gameId);

    if (!game) {
      return res.status(404).send('Partida no encontrada');
    }

    if (!game.player1) {
      game.player1 = playerNick;
    } else if (!game.player2) {
      game.player2 = playerNick;
      //game.status = 'in-progress'; // Cambia el estado de la partida a 'in-progress' cuando ambos jugadores están presentes
    } else {
      return res.status(400).send('La partida ya tiene dos jugadores');
    }

    await game.save();
    res.redirect(`/game/${game._id}`);
  } catch (err) {
    console.error('Error al unirse a la partida:', err.message);
    res.status(500).send('Error al unirse a la partida');
  }
});

// Mostrar la partida como espectador
router.get('/watch-game', ensureAuthenticated, async (req, res) => {
  const { gameId } = req.query;

  try {
    const game = await Game.findById(gameId).populate('topic');
    if (!game) {
      return res.status(404).send('Juego no encontrado');
    }

    // Calcular el tiempo restante
    const currentTime = new Date();
    let timeLeft = 0;
    if (game.status === 'in-progress') {
      const endTime = new Date(game.startTime.getTime() + game.gameTime * 60000);
      timeLeft = Math.max(Math.floor((endTime - currentTime) / 1000), 0); // en segundos
    }

    // Renderizar la página para cualquier usuario autenticado
    res.render('spectator', { game, user: req.user, timeLeft });
  } catch (err) {
    console.error('Error al ver la partida:', err.message);
    res.status(500).json({ error: 'Error al ver la partida' });
  }
});



// Iniciar una partida desde el lobby
router.post('/:id/start-game', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const gameId = req.params.id;
  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).send('Juego no encontrado');
    }

    // Cambiar el estado a "in-progress" y establecer la hora de inicio
    game.status = 'in-progress';
    game.startTime = new Date(); // Establecer el tiempo de inicio
    await game.save();

    // Emitir el evento de inicio de partida a todos los clientes conectados
    req.app.get('io').emit('gameStarted', {
      gameId: game._id,
      startTime: game.startTime,
      gameTime: game.gameTime
    });

    // Redirigir al juego para comenzar
    res.redirect(`/game/${game._id}`);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al iniciar la partida');
  }
});


module.exports = router;
