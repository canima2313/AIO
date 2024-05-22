const express = require('express');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const officeToPdf = require('office-to-pdf');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');

const app = express();
const port = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Ensure output directories exist
const outputDir = path.join(__dirname, 'converted');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Video download route
app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;
    console.log(`Received request to download: ${videoUrl}`);

    if (!ytdl.validateURL(videoUrl)) {
        console.log('Invalid URL');
        return res.status(400).send('Invalid URL');
    }

    res.header('Content-Disposition', 'attachment; filename="video.mp4"');

    ytdl(videoUrl, { format: 'mp4' })
        .on('error', err => {
            console.error('Error during download:', err);
            res.status(500).send('Error during download');
        })
        .pipe(res);
});

// Video to MP3 conversion route
app.get('/convert', async (req, res) => {
    const videoUrl = req.query.url;
    console.log(`Received request to convert: ${videoUrl}`);

    if (!ytdl.validateURL(videoUrl)) {
        console.log('Invalid URL');
        return res.status(400).send('Invalid URL');
    }

    const outputPath = path.join(outputDir, `audio_${Date.now()}.mp3`);
    console.log("Output Path:", outputPath);

    try {
        const stream = ytdl(videoUrl, { quality: 'highestaudio' });
        ffmpeg(stream)
            .audioCodec('libmp3lame')
            .toFormat('mp3')
            .on('end', () => {
                console.log('Conversion finished, sending file...');
                res.download(outputPath, 'audio.mp3', (err) => {
                    if (err) {
                        console.error('Error downloading file:', err);
                        return res.status(500).send('Error downloading file');
                    }
                    fs.unlink(outputPath, (err) => {
                        if (err) console.error('Error deleting converted file:', err);
                    });
                });
            })
            .on('error', (err) => {
                console.error('Error during conversion:', err);
                res.status(500).send('Error during conversion');
            })
            .save(outputPath);
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).send('Unexpected error during conversion');
    }
});

// Word to PDF conversion route
app.post('/convert-doc-to-pdf', upload.single('file'), async (req, res) => {
    const wordFilePath = req.file.path;
    console.log('Received Word file for conversion:', wordFilePath);

    try {
        const pdfBuffer = await officeToPdf(fs.readFileSync(wordFilePath));
        const outputPath = path.join(outputDir, `converted_${Date.now()}.pdf`);
        fs.writeFileSync(outputPath, pdfBuffer);

        res.download(outputPath, 'converted.pdf', (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                return res.status(500).send('Error downloading file');
            }
            fs.unlink(outputPath, (err) => {
                if (err) console.error('Error deleting converted file:', err);
            });
        });

        fs.unlink(wordFilePath, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });
    } catch (err) {
        console.error('Error during conversion:', err);
        res.status(500).send('Error during conversion');
    }
});

// PDF to Word conversion route
app.post('/convert-pdf-to-word', upload.single('file'), async (req, res) => {
    const pdfFilePath = req.file.path;
    console.log('Received PDF file for conversion:', pdfFilePath);

    try {
        // Load the PDF
        const pdfBytes = fs.readFileSync(pdfFilePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Extract text from PDF
        const textContent = await pdfDoc.getTextContent();

        // Create a simple DOCX file with the extracted text
        const outputPath = path.join(outputDir, `converted_${Date.now()}.docx`);
        fs.writeFileSync(outputPath, textContent.items.map(item => item.str).join('\n'));

        res.download(outputPath, 'converted.docx', (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                return res.status(500).send('Error downloading file');
            }
            fs.unlink(outputPath, (err) => {
                if (err) console.error('Error deleting converted file:', err);
            });
        });

        fs.unlink(pdfFilePath, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });
    } catch (err) {
        console.error('Error during conversion:', err);
        res.status(500).send('Error during conversion');
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}/home.html`);
});
