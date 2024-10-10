require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const videoRoutes = require('./routes/videoRoutes');

const app = express();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Conectado ao MongoDB'))
.catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

app.use(cors());
app.use(express.json());

app.use('/api/videos', videoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;