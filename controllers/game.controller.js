router.post('/new', async (req, res) => {
  try {
    console.log('Request Body:', req.body); // Verifica los datos recibidos

    const { player1, player2 } = req.body;
    if (!player1) {
      return res.status(400).send('El campo player1 es requerido.');
    }

    // Obtiene todos los temas disponibles
    const topics = await Topic.find();
    if (topics.length === 0) {
      return res.status(400).send('No hay temas disponibles para crear una partida.');
    }

    // Selecciona un tema aleatorio
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    // Crea una nueva partida
    const game = new Game({
      player1,
      player2: player2 || null, // player2 puede ser opcional
      topic: randomTopic._id, // Asigna el tema aleatorio
      status: 'waiting', // Asegúrate de establecer el estado
    });

    // Guarda la partida en la base de datos
    await game.save();
    res.redirect(`/game/${game._id}`);
  } catch (err) {
    console.error('Error al crear el juego:', err.message);
    res.status(500).send('Error al crear la partida. Por favor, inténtelo de nuevo.');
  }
});
