module.exports = function ensureAdmin(req, res, next) {
    // Verifica si req.user existe y si es un admin
    if (req.user && req.user.isAdmin) {
      return next();
    }
    // Redirige a la página principal si el usuario no es admin
    res.redirect('/lobby'); // O redirige a otro lugar si prefieres
  };
  