
const express = require('express');
const fs = require('fs-extra');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
const imageHash = require('image-hash');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route to generate PDF from YouTube URL
app.post('/generate-pdf', async (req, res) => {
  const url = req.body.url;
  const id = uuidv4();
  const videoPath = `./temp/${id}.mp4`;
  const framesDir = `./temp/frames_${id}`;
  const pdfPath = `./temp/${id}.pdf`;

  try {
    await fs.ensureDir(framesDir);

    // Step 1: Download video
    await new Promise((resolve, reject) => {
      ytdl(url, { quality: 'lowest' })
        .pipe(fs.createWriteStream(videoPath))
        .on('finish', resolve)
        .on('error', reject);
    });

    // Step 2: Extract frames using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .on('end', resolve)
        .on('error', reject)
        .screenshots({
          count: 30,
          folder: framesDir,
          filename: 'frame-%03d.png',
        });
    });

    // Step 3: Remove duplicate images using perceptual hash
    const files = (await fs.readdir(framesDir)).filter(f => f.endsWith('.png')).sort();
    const uniqueImages = [];
    let lastHash = null;

    const getHash = imgPath =>
      new Promise((resolve, reject) => {
        imageHash.hash(imgPath, 16, true, (err, hash) => {
          if (err) reject(err);
          else resolve(hash);
        });
      });

    for (const file of files) {
      const imgPath = path.join(framesDir, file);
      const hash = await getHash(imgPath);

      if (hash !== lastHash) {
        uniqueImages.push(imgPath);
        lastHash = hash;
      } else {
        await fs.remove(imgPath);
      }
    }

    // Step 4: Generate PDF
    const doc = new PDFDocument({ autoFirstPage: false });
    const pdfStream = fs.createWriteStream(pdfPath);
    doc.pipe(pdfStream);

    for (const imgPath of uniqueImages) {
      const image = await sharp(imgPath).resize(800).toBuffer();
      const { width, height } = await sharp(image).metadata();
      doc.addPage({ size: [width, height] });
      doc.image(image, 0, 0, { width });
    }

    doc.end();
    await new Promise(resolve => pdfStream.on('finish', resolve));

    // Send PDF back
    res.download(pdfPath, 'output.pdf', async () => {
      await fs.remove(videoPath);
      await fs.remove(framesDir);
      await fs.remove(pdfPath);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating PDF');
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

// Create temp folder if it doesn't exist
fs.ensureDirSync('./temp');

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
