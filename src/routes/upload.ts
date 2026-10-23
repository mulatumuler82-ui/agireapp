import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../utils/errors';

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Only JPG, PNG or WEBP images are allowed')),
});

const router = Router();
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image uploaded');
  res.status(201).json({ url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` });
});
export default router;
