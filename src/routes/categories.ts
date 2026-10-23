import { Router } from 'express';
import { prisma } from '../prisma';
import { asyncHandler } from '../utils/errors';

const router = Router();
router.get('/', asyncHandler(async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: 'asc' } }));
}));
export default router;
