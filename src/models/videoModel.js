const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'error'],
    default: 'uploading'
  },
  urlOriginal: String,
  urlProcessada: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Video', videoSchema);