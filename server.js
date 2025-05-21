const express = require('express');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.post('/merge', async (req, res) => {
  const files = req.body.files;
  if (!files || files.length < 2) {
    return res.status(400).json({ error: 'Minimum 2 audio URLs required.' });
  }

  const tempDir = `./temp/${uuidv4()}`;
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const downloadedPaths = [];
    for (let i = 0; i < files.length; i++) {
      const url = files[i];
      const filePath = `${tempDir}/audio${i}.mp3`;
      const writer = fs.createWriteStream(filePath);
      const response = await axios({ method: 'GET', url, responseType: 'stream' });
      response.data.pipe(writer);
      await new Promise((resolve) => writer.on('finish', resolve));
      downloadedPaths.push(filePath);
    }

    const listPath = `${tempDir}/list.txt`;
    const listFile = downloadedPaths.map(path => `file '${path}'`).join('\n');
    fs.writeFileSync(listPath, listFile);

    const outputPath = `${tempDir}/merged.mp3`;
    ffmpeg()
      .setFfmpegPath(ffmpegPath)
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions('-c', 'copy')
      .on('end', () => {
        res.sendFile(outputPath, () => fs.rmSync(tempDir, { recursive: true, force: true }));
      })
      .on('error', err => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        res.status(500).json({ error: err.message });
      })
      .save(outputPath);

  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
