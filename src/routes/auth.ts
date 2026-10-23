import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../prisma';
import { config } from '../config';
import { ApiError, asyncHandler } from '../utils/errors';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().min(7).max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['FARMER', 'BUYER']),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export const publicUser = {
  id: true, name: true, email: true, phone: true, role: true, avatarUrl: true, address: true, lat: true, lng: true,
} as const;

function tokens(user: { id: number; role: string }) {
  const payload = { id: user.id, role: user.role };
  return {
    accessToken: jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' }),
    refreshToken: jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' }),
  };
}

router.post('/register', asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new ApiError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, role: data.role, passwordHash },
    select: publicUser,
  });
  res.status(201).json({ user, ...tokens(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(401, 'Incorrect email or password');
  const { passwordHash, ...safe } = user;
  res.json({ user: safe, ...tokens(user) });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
  try {
    const p = jwt.verify(refreshToken, config.jwtRefreshSecret) as any;
    const user = await prisma.user.findUnique({ where: { id: p.id } });
    if (!user) throw new Error();
    res.json({ accessToken: tokens(user).accessToken });
  } catch {
    throw new ApiError(401, 'Session expired, please log in again');
  }
}));

// Tokens are stateless; the client discards them on logout.
router.post('/logout', (_req, res) => res.status(204).end());

export default router;
