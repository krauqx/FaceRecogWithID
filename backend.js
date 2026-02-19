// backend.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS Configuration
const corsSite = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsSite));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files
app.use('/models', express.static(path.join(__dirname, 'public', 'models')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// List available upload files (for frontend selection)
app.get('/api/uploads', async (req, res) => {
  try {
    const files = await fs.promises.readdir(uploadDir);
    // basic image filter
    const imageFiles = files.filter((f) =>
      /\.(jpe?g|png|webp)$/i.test(f)
    );
    res.json({ files: imageFiles });
  } catch (err) {
    console.error('Error reading uploads directory:', err);
    res.status(500).json({ error: 'Failed to read uploads directory' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


export default app;