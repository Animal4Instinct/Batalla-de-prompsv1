const jwt = require('jsonwebtoken');

const ensureAuthenticated = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect('/auth/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Token inválido:', err.message);
    return res.redirect('/auth/login');
  }
};

module.exports = ensureAuthenticated;
