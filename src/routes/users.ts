import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../utils/errors';
import { publicUser } from './auth';

const router = Router();
router.use(requireAuth);

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(7).max(20).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

router.get('/me', asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: publicUser });
  if (!user) throw new ApiError(404, 'User not found');
  res.json(user);
}));

router.put('/me', asyncHandler(async (req: AuthRequest, res) => {
  const data = updateSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data, select: publicUser });
  res.json(user);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: { id: true, name: true, phone: true, avatarUrl: true, address: true, lat: true, lng: true, role: true },
  });
  if (!user) throw new ApiError(404, 'User not found');
  res.json(user);
}));

export default router;
