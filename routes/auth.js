const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const ensureAuthenticated = require('../middleware/authMiddleware'); // Requerir middleware

// Mostrar la página de registro
router.get('/register', (req, res) => {
  // Obtener el mensaje de error de la query string si está presente
  const errorMessage = req.query.errorMessage || null;
  res.render('register', { errorMessage });
});

// Registro de usuario
router.post('/register', async (req, res) => {
  const { name, email, password, isAdmin } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: 'Por favor, ingrese todos los campos' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'Usuario ya registrado' });

    user = new User({ name, email, password, isAdmin: isAdmin || false });
    await user.save();

    res.redirect('/auth/login');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error en el servidor');
  }
});


// Mostrar la página de login
router.get('/login', (req, res) => {
  // Obtén el mensaje de error de la query string si existe
  const { errorMessage } = req.query;
  res.render('login', { errorMessage: errorMessage || '' });
});

// Login de usuario
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: 'Por favor, ingrese todos los campos' });
  }

  try {
    let user = await User.findOne({ email });
    if (!user || user.password !== password) return res.status(400).json({ msg: 'Credenciales inválidas' });

    const payload = { user: { id: user.id, name: user.name, isAdmin: user.isAdmin } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, { httpOnly: true, maxAge: 3600000 }); // 1 hora
    res.redirect('/lobby');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error en el servidor');
  }
});

// Logout del usuario
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/auth/login');
});

module.exports = router;
