import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 1. Storage Engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Make sure this folder exists in /backend
  },
  filename: (req, file, cb) => {
    // Renaming to UUID to prevent filename collisions (Matches your Python logic)
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

// 2. File Filter (Matches your ALLOWED_MIME_TYPES)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'application/pdf',
    'application/msword', 'text/plain', 'audio/mpeg', 'video/mp4'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, docs, audio, and video are allowed.'), false);
  }
};

// 3. Export the Middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB Limit
});