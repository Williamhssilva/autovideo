const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const Video = require('../models/videoModel');
const axios = require('axios');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
require('dotenv').config();

async function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

const videoProcessingService = {
  processVideo: async (videoId) => {
    try {
      const video = await Video.findById(videoId);
      if (!video) {
        throw new Error('Vídeo não encontrado');
      }

      video.status = 'processing';
      await video.save();

      console.log('Iniciando processamento do vídeo:', video.urlOriginal);

      // 1. Extrair áudio do vídeo
      const audioPath = await extractAudio(video.urlOriginal);
      console.log('Áudio extraído:', audioPath);

      // 2. Transcrever o áudio
      console.log('Iniciando transcrição do áudio...');
      const transcription = await transcribeAudio(audioPath);
      console.log('Transcrição concluída:', transcription);

      // 3. Cortar o vídeo em segmentos de 60 segundos
      const segments = await cutVideoIntoSegments(video.urlOriginal);
      console.log('Vídeo cortado em segmentos:', segments);

      // 4. Adicionar legendas aos segmentos
      console.log('Iniciando adição de legendas aos segmentos...');
      const processedSegments = await addSubtitlesToSegments(segments, transcription);
      console.log('Legendas adicionadas aos segmentos:', processedSegments);

      // 5. Atualizar o status do vídeo
      video.status = 'ready';
      video.urlProcessada = processedSegments[0];
      await video.save();

      console.log('Processamento de vídeo concluído com sucesso');
      return processedSegments;
    } catch (error) {
      console.error('Erro ao processar vídeo:', error);
      await Video.findByIdAndUpdate(videoId, { status: 'error' });
      throw error;
    }
  }
};

async function extractAudio(videoPath) {
  const audioPath = videoPath.replace('.mp4', '.wav');
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-acodec', 'pcm_s16le',
        '-ac', '1',
        '-ar', '16000'
      ])
      .save(audioPath)
      .on('end', () => resolve(audioPath))
      .on('error', (err) => reject(err));
  });
}

async function transcribeAudio(audioPath) {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  console.log('Dividindo o áudio em segmentos...');
  const segments = await splitAudio(audioPath);
  console.log(`Áudio dividido em ${segments.length} segmentos.`);

  let fullTranscription = '';
  for (let i = 0; i < segments.length; i++) {
    console.log(`Transcrevendo segmento ${i + 1} de ${segments.length}...`);
    const segmentTranscription = await transcribeAudioSegment(segments[i], apiKey);
    fullTranscription += segmentTranscription + ' ';
  }

  console.log('Transcrição completa:', fullTranscription);
  return fullTranscription.trim();
}

async function splitAudio(audioPath) {
  const segmentDir = path.join(path.dirname(audioPath), 'segments');
  if (!fs.existsSync(segmentDir)) {
    await fsPromises.mkdir(segmentDir, { recursive: true });
  }

  const duration = await getAudioDuration(audioPath);
  console.log(`Duração total do áudio: ${duration} segundos`);
  const segmentDuration = 59; // 59 segundos por segmento
  const segments = [];

  for (let i = 0; i < duration; i += segmentDuration) {
    const outputPath = path.join(segmentDir, `segment_${i}.wav`);
    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .setStartTime(i)
        .setDuration(Math.min(segmentDuration, duration - i))
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    segments.push(outputPath);
    console.log(`Segmento criado: ${outputPath}`);
  }

  return segments;
}

async function transcribeAudioSegment(segmentPath, apiKey) {
  const audioContent = fs.readFileSync(segmentPath).toString('base64');

  try {
    const response = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'pt-BR',
        },
        audio: {
          content: audioContent,
        },
      }
    );

    return response.data.results
      .map(result => result.alternatives[0].transcript)
      .join(' ');
  } catch (error) {
    console.error('Erro na transcrição do segmento:', error.response ? error.response.data : error.message);
    return '';
  }
}

async function cutVideoIntoSegments(videoPath) {
  const segmentDuration = 60;
  const segmentDir = path.join(path.dirname(videoPath), 'segments');
  if (!fs.existsSync(segmentDir)) {
    fs.mkdirSync(segmentDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([`-segment_time ${segmentDuration}`, '-f segment'])
      .output(path.join(segmentDir, 'segment%03d.mp4'))
      .on('end', () => {
        const segments = fs.readdirSync(segmentDir)
          .filter(file => file.startsWith('segment') && file.endsWith('.mp4'))
          .map(file => path.join(segmentDir, file));
        resolve(segments);
      })
      .on('error', (err) => reject(err))
      .run();
  });
}

async function createSrtFile(transcription, duration) {
  const words = transcription.split(' ');
  const wordsPerSecond = words.length / duration;
  let srtContent = '';
  let lineCount = 1;
  let startTime = 0;
  const maxSubtitleLength = 100; // Limite máximo de caracteres por legenda

  console.log(`Criando arquivo SRT para transcrição: "${transcription}"`);
  console.log(`Duração: ${duration} segundos`);

  while (words.length > 0 && startTime < duration) {
    const endTime = Math.min(startTime + 5, duration);
    let wordsForSegment = Math.floor((endTime - startTime) * wordsPerSecond);
    let subtitle = '';

    while (subtitle.length < maxSubtitleLength && words.length > 0 && wordsForSegment > 0) {
      subtitle += words.shift() + ' ';
      wordsForSegment--;
    }

    subtitle = subtitle.trim();
    
    if (subtitle) {
      srtContent += `${lineCount}\n`;
      srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
      srtContent += `${subtitle}\n\n`;
      lineCount++;
    }

    startTime = endTime;
  }

  if (srtContent === '') {
    console.error('Conteúdo SRT vazio. Transcrição pode estar vazia.');
    return null;
  }

  const srtPath = path.join(path.dirname(require.main.filename), `subtitles_${Date.now()}.srt`);
  await fsPromises.writeFile(srtPath, srtContent);
  console.log(`Arquivo SRT criado: ${srtPath}`);
  console.log(`Conteúdo do arquivo SRT:\n${srtContent}`);
  return srtPath;
}

function formatTime(seconds) {
  const date = new Date(Math.floor(seconds) * 1000);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  return date.toISOString().substr(11, 8) + ',' + milliseconds.toString().padStart(3, '0');
}

async function addSubtitlesToSegments(segments, transcription) {
  const segmentDuration = 59; // Duração de cada segmento em segundos
  
  return Promise.all(segments.map(async (segment, index) => {
    const startTime = index * segmentDuration;
    const endTime = (index + 1) * segmentDuration;
    const segmentTranscription = transcription.split(' ').slice(
      Math.floor(startTime * (transcription.split(' ').length / (segments.length * segmentDuration))),
      Math.floor(endTime * (transcription.split(' ').length / (segments.length * segmentDuration)))
    ).join(' ');

    const srtPath = await createSrtFile(segmentTranscription, segmentDuration);
    if (!srtPath) {
      console.log(`Nenhum arquivo SRT criado para o segmento ${index + 1}. Pulando a adição de legendas.`);
      return segment; // Retorna o segmento original sem legendas
    }

    const outputPath = path.resolve(segment.replace('.mp4', '_subtitled.mp4'));
    
    console.log(`Processando segmento ${index + 1}:`);
    console.log(`Entrada: ${segment}`);
    console.log(`Saída: ${outputPath}`);
    console.log(`SRT: ${srtPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(segment)
        .inputOptions('-i', srtPath)
        .outputOptions(
          '-c:v', 'libx264',
          '-c:a', 'copy',
          '-c:s', 'mov_text',
          '-metadata:s:s:0', 'language=por'
        )
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('Comando FFmpeg:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Progresso: ${progress.percent}%`);
        })
        .on('end', async () => {
          console.log(`Segmento ${index + 1} concluído`);
          try {
            // Adiciona um atraso de 1 segundo antes de tentar excluir o arquivo SRT
            await new Promise(resolve => setTimeout(resolve, 1000));
            await fsPromises.unlink(srtPath);
          } catch (error) {
            console.error(`Erro ao excluir arquivo SRT: ${error}`);
          }
          resolve(outputPath);
        })
        .on('error', (err, stdout, stderr) => {
          console.error('Erro FFmpeg:', err);
          console.error('FFmpeg stdout:', stdout);
          console.error('FFmpeg stderr:', stderr);
          reject(err);
        })
        .run();
    });
  }));
}

module.exports = videoProcessingService;