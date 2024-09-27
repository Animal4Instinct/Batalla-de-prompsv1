const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const ensureAdmin = require('../middleware/ensureAdmin');
const ensureAuthenticated = require('../middleware/authMiddleware');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const axios = require('axios'); // Puedes usar axios en lugar de fetch


// Mostrar la página del juego
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id).populate('topic');
    if (!game) {
      return res.status(404).send('Juego no encontrado');
    }

    // Calcular el tiempo restante
    const now = new Date();
    let timeLeft = 0;

    if (game.status === 'in-progress') {
      const endTime = new Date(game.startTime.getTime() + game.gameTime * 60000);
      timeLeft = Math.max(Math.floor((endTime - now) / 1000), 0); // en segundos
    }

    // Determina si el usuario es administrador
    const isAdmin = req.user && req.user.role === 'admin';

    res.render('game', { game, user: req.user, timeLeft, isAdmin });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error en el servidor');
  }
});


// Ruta para generar imágenes
router.post('/:id/generate-image', ensureAuthenticated, async (req, res) => {
  const { player, prompt } = req.body;
  const gameId = req.params.id;

  try {
    // Validar ID de juego
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).send('ID de juego inválido');
    }

    // Buscar el juego en la base de datos
    const game = await Game.findById(gameId);
    if (!game || game.status !== 'in-progress') {
      return res.status(400).send('La partida no está en progreso');
    }

    // Validar el prompt
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).send('El prompt no puede estar vacío');
    }

    // Generar imagen usando el API (cambiar a axios)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;

    try {
      const response = await axios.get(imageUrl, { timeout: 30000 }); // Tiempo de espera de 30 segundos
      if (response.status === 200) {
        const generatedImageUrl = response.request.res.responseUrl;

        // Guardar la imagen generada en el juego
        game.images.push({ player, imageUrl: generatedImageUrl });
        await game.save();

        // Emitir el evento a través de Socket.IO
        req.app.get('io').to(gameId).emit('imageGenerated', { player, imageUrl: generatedImageUrl });

        // Responder con la URL de la imagen generada
        res.json({ imageUrl: generatedImageUrl });
      } else {
        res.status(response.status).send('Error al generar la imagen');
      }
    } catch (apiError) {
      console.error('Error al llamar a la API de generación de imágenes:', apiError.message);
      res.status(500).send('Error en la generación de imágenes');
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al procesar la solicitud');
  }
});

// Ruta para seleccionar el ganador manualmente
router.post('/:id/select-winner', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const { winner } = req.body;
  const gameId = req.params.id;

  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).send('Partida no encontrada');
    }

    // Guardar ganador, fecha y hora de finalización
    game.winner = winner;
    game.endTime = new Date();
    game.status = 'completed';

    await game.save();

    // Emitir el evento de selección de ganador
    req.app.get('io').to(gameId).emit('winnerSelected', { winner });

    // Informar a los jugadores y redirigir al lobby
    req.flash('success', `El ganador es ${winner}.`);
    res.redirect('/lobby');
  } catch (err) {
    console.error(err.message);
    req.flash('error', 'Error al finalizar la partida');
    res.redirect('/lobby');
  }
});


// Manejar votación pública
router.post('/:id/vote', ensureAuthenticated, async (req, res) => {
  const { player } = req.body;
  const gameId = req.params.id;
  const userIp = req.ip;

  try {
    const game = await Game.findById(gameId);

    // Comprobar si el usuario ya ha votado
    if (game.voters.includes(userIp)) {
      return res.status(400).json({ message: 'Ya has votado.' });
    }

    // Comprobar si el tiempo de votación ha terminado
    if (Date.now() > game.votingEndTime) {
      return res.status(400).json({ message: 'El tiempo de votación ha terminado.' });
    }

    // Registrar el voto
    if (player === 'player1') {
      game.player1Votes = (game.player1Votes || 0) + 1;
    } else if (player === 'player2') {
      game.player2Votes = (game.player2Votes || 0) + 1;
    }

    game.voters.push(userIp);
    await game.save();

    // Emitir el evento para actualizar la interfaz
    req.app.get('io').to(gameId).emit('voteUpdate', { player1Votes: game.player1Votes, player2Votes: game.player2Votes });

    res.json({ message: 'Voto registrado', votes: { player1: game.player1Votes, player2: game.player2Votes } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al registrar el voto');
  }
});



// Mostrar el resultado de la votación pública
router.get('/:id/result', ensureAuthenticated, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).send('Juego no encontrado');
    }

    // Verificar si la votación ha terminado
    if (Date.now() <= game.votingEndTime) {
      return res.status(400).send('La votación aún está en curso.');
    }

    // Determinar el ganador
    const winner = game.player1Votes > game.player2Votes ? 'player1' : 'player2';
    game.winner = winner;
    game.status = 'completed';
    await game.save();

    // Emitir el evento para anunciar el ganador
    req.app.get('io').to(req.params.id).emit('winnerSelected', { winner });

    res.json({ message: 'Votación completada', winner });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al mostrar el resultado');
  }
});



// Función para emitir el tiempo restante a los clientes
function emitTimeRemaining(game) {
  const now = new Date();
  const endTime = new Date(game.startTime.getTime() + game.gameTime * 60000);
  const timeLeft = Math.max(Math.floor((endTime - now) / 1000), 0); // Tiempo restante en segundos

  // Emitir el evento a todos los clientes conectados
  req.app.get('io').to(game._id).emit('timeUpdate', {
    gameId: game._id,
    timeLeft: timeLeft
  });
}

// Inicia una partida desde el lobby
router.post('/:id/start', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const gameId = req.params.id;
  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).send('Juego no encontrado');
    }

    game.status = 'in-progress';
    game.startTime = new Date();
    await game.save();

    // Emitir el evento de inicio de partida
    req.app.get('io').to(gameId).emit('gameStarted', {
      gameId: game._id,
      startTime: game.startTime,
      gameTime: game.gameTime
    });

    // Emitir el evento de actualización del temporizador cada segundo
    const intervalId = setInterval(async () => {
      const now = new Date();
      const endTime = new Date(game.startTime.getTime() + game.gameTime * 60000);
      const timeLeft = Math.max(Math.floor((endTime - now) / 1000), 0); // en segundos

      req.app.get('io').to(gameId).emit('timeUpdate', { timeLeft });

      if (timeLeft <= 0) {
        clearInterval(intervalId);
        
        // Emitir un evento para indicar que la partida ha terminado
        req.app.get('io').to(gameId).emit('gameEnded', { gameId: game._id });

        // Emitir un evento para que el modo de votación se muestre
        req.app.get('io').to(gameId).emit('votingStarted');
      }
    }, 1000);

    res.redirect(`/game/${game._id}`);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al iniciar la partida');
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

module.exports = router;
