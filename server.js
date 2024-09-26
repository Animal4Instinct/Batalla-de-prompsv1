const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const ensureAdmin = require('../Batalla de promps/middleware/ensureAdmin');
const ensureAuthenticated = require('../Batalla de promps/middleware/authMiddleware');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Configurar los orígenes permitidos para conexiones de socket
    methods: ['GET', 'POST'],
  },
});

// Conexión a MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

connectDB();

// Configuración de express-session
app.use(session({
  secret: 'your_secret_key', // Cambia esta clave secreta a algo más seguro
  resave: false,
  saveUninitialized: true,
}));

// Configuración de connect-flash
app.use(flash());

// Middleware para pasar mensajes flash a las vistas
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(express.json());

// Archivos estáticos y vistas
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('io', io); // Almacenar la instancia de io en app para acceder en las rutas

// Rutas
app.use('/auth', require('./routes/auth'));
app.use('/lobby', ensureAuthenticated, require('./routes/lobby'));
app.use('/topics', ensureAuthenticated, require('./routes/topics'));
app.use('/game', ensureAuthenticated, require('./routes/game'));

// Middleware para añadir el usuario a res.locals
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Redirección en la raíz
app.get('/', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      res.redirect('/lobby');
    } catch (err) {
      console.error('Token inválido:', err.message);
      res.redirect('/auth/login');
    }
  } else {
    res.redirect('/auth/login');
  }
});

// Función para el temporizador
const startTimer = (gameId, gameTime) => {
  const interval = 1000;
  const endTime = new Date(Date.now() + gameTime * 60000);

  const timerInterval = setInterval(() => {
    const timeLeft = Math.max(Math.floor((endTime - Date.now()) / 1000), 0);
    io.to(gameId).emit('timerUpdate', { timeLeft });

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      io.to(gameId).emit('timeExpired');
      // Aquí puedes cambiar el estado del juego en la base de datos
    }
  }, interval);
};

// Configuración de Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('promptUpdate', ({ gameId, player, prompt }) => {
    // Emitir la actualización del prompt a todos los usuarios en la sala del juego
    io.to(gameId).emit('promptUpdate', { player, prompt }); // Cambia a 'promptUpdate'
  });


  socket.on('joinGame', (gameId) => {
    socket.join(gameId);
    console.log(`Client joined game ${gameId}`);
  });

  socket.on('startGame', ({ gameId, gameTime }) => {
    startTimer(gameId, gameTime);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  socket.on('startVoting', (gameId) => {
    io.to(gameId).emit('votingStarted');
  });

  socket.on('selectWinner', ({ gameId, winner }) => {
    io.to(gameId).emit('winnerSelected', { winner });
  });

});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };
