const Video = require('../models/videoModel');
const multer = require('multer');
const path = require('path');
const videoProcessingService = require('../services/videoProcessingService');

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Certifique-se de que esta pasta existe
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

const videoController = {
  uploadVideo: [
    upload.single('video'), // 'video' é o nome do campo no formulário
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
        }

        const novoVideo = new Video({
          titulo: req.body.titulo,
          status: 'uploading',
          urlOriginal: req.file.path
        });

        await novoVideo.save();

        // Iniciar o processamento do vídeo de forma assíncrona
        videoProcessingService.processVideo(novoVideo._id)
          .catch(erro => console.error('Erro ao processar vídeo:', erro));

        res.status(201).json({ mensagem: 'Vídeo enviado com sucesso', id: novoVideo._id });
      } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao fazer upload do vídeo' });
      }
    }
  ],

  getVideoStatus: async (req, res) => {
    try {
      const video = await Video.findById(req.params.id);
      if (!video) {
        return res.status(404).json({ erro: 'Vídeo não encontrado' });
      }
      res.json({ status: video.status });
    } catch (erro) {
      console.error(erro);
      res.status(500).json({ erro: 'Erro ao buscar status do vídeo' });
    }
  },

  listVideos: async (req, res) => {
    try {
      const videos = await Video.find().select('titulo status createdAt');
      res.json(videos);
    } catch (erro) {
      console.error(erro);
      res.status(500).json({ erro: 'Erro ao listar vídeos' });
    }
  }
};

module.exports = videoController;