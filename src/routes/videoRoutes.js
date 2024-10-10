const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

router.post('/upload', videoController.uploadVideo);
router.get('/status/:id', videoController.getVideoStatus);
router.get('/list', videoController.listVideos);

module.exports = router;