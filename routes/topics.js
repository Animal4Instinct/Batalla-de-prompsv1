const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic');
const ensureAuthenticated = require('../middleware/authMiddleware');
const ensureAdmin = require('../middleware/ensureAdmin');

// Mostrar formulario para añadir un nuevo tema
router.get('/add', ensureAuthenticated,(req, res) => {
  res.render('add-topic');
});

// Añadir un nuevo tema
router.post('/add',  ensureAuthenticated, async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).send('El título es requerido y debe ser una cadena válida.');
    }

    const topic = new Topic({ title: title.trim() }); // Elimina espacios en blanco alrededor del título
    await topic.save();
    res.redirect('/lobby'); // Redirige al lobby después de añadir el tema
  } catch (err) {
    console.error('Error al añadir el tema:', err.message);
    res.status(500).send('Error en el servidor');
  }
});

// Mostrar todos los temas
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const topics = await Topic.find();
    
    if (!topics || topics.length === 0) {
      return res.status(404).send('No se encontraron temas.');
    }
    
    res.render('topics', { topics });
  } catch (err) {
    console.error('Error al obtener los temas:', err.message);
    res.status(500).send('Error en el servidor');
  }
});

router.get('/lobby', ensureAuthenticated, (req, res) => {
  res.render('lobby');
});

module.exports = router;