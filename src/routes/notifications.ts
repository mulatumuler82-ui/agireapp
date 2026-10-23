import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/errors';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  res.json(await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 }));
}));

router.patch('/:id/read', asyncHandler(async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({ where: { id: Number(req.params.id), userId: req.user!.id }, data: { isRead: true } });
  res.json({ ok: true });
}));

export default router;
