// backend.js
import multer from 'multer';
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
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsSite));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// --- simple JSON DB (persistent) ---
const dataDir = path.join(__dirname, 'data');
const studentsFile = path.join(dataDir, 'students.json');

const ensureDb = async () => {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(studentsFile)) {
    await fs.promises.writeFile(studentsFile, JSON.stringify({}, null, 2), 'utf8');
  }
};

const readStudents = async () => {
  await ensureDb();
  const raw = await fs.promises.readFile(studentsFile, 'utf8');
  return JSON.parse(raw || '{}');
};

const writeStudents = async (obj) => {
  await ensureDb();
  await fs.promises.writeFile(studentsFile, JSON.stringify(obj, null, 2), 'utf8');
};

// --- ID helpers ---
const pad2 = (n) => String(n).padStart(2, '0');
const pad4 = (n) => String(n).padStart(4, '0');
const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '');

const formatDisplayId = (id7) => {
  const d = digitsOnly(id7);
  if (d.length !== 7) return d;
  return `${d.slice(0, 2)}-${d.slice(2, 3)}-${d.slice(3)}`;
};

const generateUniqueId = (entryYear, students) => {
  const yy = pad2(Number(entryYear) % 100);
  const usedIdNos = new Set(Object.values(students).map((s) => digitsOnly(s.id).slice(-4)));

  for (let i = 0; i < 10000; i++) {
    const idNo = pad4(Math.floor(Math.random() * 10000));
    if (usedIdNos.has(idNo)) continue;

    const id = `${yy}4${idNo}`;
    if (students[id]) continue;
    return { id, displayId: `${yy}-4-${idNo}` };
  }
  throw new Error('ID space exhausted: cannot generate a unique 4-digit IDNo.');
};

// Multer: allow single or multiple images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024, // 500KB per file
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Invalid file type. Use JPEG, PNG, or WebP.'));
  },
});

// Serve static files
app.use('/models', express.static(path.join(__dirname, 'public', 'models')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// List available upload files (for frontend selection)
app.get('/api/uploads', async (req, res) => {
  try {
    const files = await fs.promises.readdir(uploadDir);
    const imageFiles = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    res.json({ files: imageFiles });
  } catch (err) {
    console.error('Error reading uploads directory:', err);
    res.status(500).json({ error: 'Failed to read uploads directory' });
  }
});

// Return full students map
app.get('/api/students', async (req, res) => {
  try {
    const students = await readStudents();
    res.json({ students });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read students DB' });
  }
});

// Return list of IDs only (useful for OCR matching)
app.get('/api/students/ids', async (req, res) => {
  try {
    const students = await readStudents();
    res.json({ ids: Object.keys(students) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read students DB' });
  }
});

// Generate ID without saving
app.post('/api/students/generate-id', async (req, res) => {
  try {
    const { year } = req.body || {};
    if (!Number.isInteger(Number(year))) {
      return res.status(400).json({ error: 'year must be a number (YYYY)' });
    }
    const students = await readStudents();
    const generated = generateUniqueId(Number(year), students);
    res.json(generated);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to generate ID' });
  }
});

/**
 * Register student + upload face photo(s)
 * Supports:
 * - legacy: field "photo" (single)
 * - new: field "photos" (multiple)
 */
app.post(
  '/api/students/register',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'photos', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const { name, department, year, email, id } = req.body || {};
      if (!name || !department || !year || !email) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const students = await readStudents();

      let canonicalId = digitsOnly(id);
      if (!canonicalId) canonicalId = generateUniqueId(Number(year), students).id;

      if (!/^\d{7}$/.test(canonicalId)) {
        return res.status(400).json({ error: 'Invalid ID. Expected 7 digits (YY4####).' });
      }

      // Enforce IDNo uniqueness (last 4 digits)
      const idNo = canonicalId.slice(-4);
      const usedIdNos = new Set(Object.values(students).map((s) => digitsOnly(s.id).slice(-4)));
      if (usedIdNos.has(idNo)) {
        return res.status(409).json({ error: 'Duplicate IDNo detected. Generate again.' });
      }
      if (students[canonicalId]) {
        return res.status(409).json({ error: 'Student ID already exists.' });
      }

      const files =
        (req.files?.photos && req.files.photos.length ? req.files.photos : null) ||
        (req.files?.photo && req.files.photo.length ? req.files.photo : null);

      if (!files || !files.length) {
        return res.status(400).json({ error: 'Missing photo upload.' });
      }

      const savedPaths = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext =
          f.mimetype === 'image/png' ? 'png' : f.mimetype === 'image/webp' ? 'webp' : 'jpg';

        const filename = i === 0 ? `${canonicalId}.${ext}` : `${canonicalId}_${i + 1}.${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.promises.writeFile(filePath, f.buffer);
        savedPaths.push(`/uploads/${filename}`);
      }

      const student = {
        id: canonicalId,
        displayId: formatDisplayId(canonicalId),
        name: String(name),
        department: String(department),
        year: String(year),
        email: String(email),
        faceImage: savedPaths[0],       // keep legacy field
        faceImages: savedPaths,         // NEW
        createdAt: new Date().toISOString(),
      };

      students[canonicalId] = student;
      await writeStudents(students);

      return res.json({ success: true, student });
    } catch (e) {
      const msg = e?.message || 'Registration failed';
      const isSize = msg.toLowerCase().includes('file too large');
      return res.status(isSize ? 413 : 400).json({ error: msg });
    }
  }
);

/**
 * Add more face photos to an existing student (recommended for accuracy)
 * POST /api/students/:id/add-photos  (field: photos[])
 */
app.post('/api/students/:id/add-photos', upload.array('photos', 10), async (req, res) => {
  try {
    const canonicalId = digitsOnly(req.params.id);
    const students = await readStudents();

    if (!students[canonicalId]) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Missing photos upload.' });
    }

    const current = students[canonicalId];
    const currentImages = Array.isArray(current.faceImages) && current.faceImages.length
      ? current.faceImages
      : current.faceImage
        ? [current.faceImage]
        : [];

    let startIndex = currentImages.length + 1; // next suffix

    const newPaths = [];
    for (let i = 0; i < req.files.length; i++) {
      const f = req.files[i];
      const ext =
        f.mimetype === 'image/png' ? 'png' : f.mimetype === 'image/webp' ? 'webp' : 'jpg';

      const filename = `${canonicalId}_${startIndex + i}.${ext}`;
      const filePath = path.join(uploadDir, filename);

      await fs.promises.writeFile(filePath, f.buffer);
      newPaths.push(`/uploads/${filename}`);
    }

    const updatedImages = [...currentImages, ...newPaths];

    students[canonicalId] = {
      ...current,
      faceImage: updatedImages[0],
      faceImages: updatedImages,
      updatedAt: new Date().toISOString(),
    };

    await writeStudents(students);

    return res.json({ success: true, student: students[canonicalId] });
  } catch (e) {
    return res.status(400).json({ error: e?.message || 'Failed to add photos' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;