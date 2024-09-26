const mongoose = require('mongoose');
const TopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: 3, // Longitud mínima del título
    maxlength: 100, // Longitud máxima del título
  },
});

// Indexar el campo title para mejorar el rendimiento en consultas
TopicSchema.index({ title: 1 });

module.exports = mongoose.model('Topic', TopicSchema);
