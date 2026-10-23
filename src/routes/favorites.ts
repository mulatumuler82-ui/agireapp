import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../utils/errors';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const favs = await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    include: { product: { include: { category: true, seller: { select: { id: true, name: true, phone: true, avatarUrl: true, address: true } } } } },
  });
  res.json(favs.map((f) => ({ ...f.product, isFavorite: true })));
}));

router.post('/:productId', asyncHandler(async (req: AuthRequest, res) => {
  const productId = Number(req.params.productId);
  if (!(await prisma.product.findUnique({ where: { id: productId } }))) throw new ApiError(404, 'Product not found');
  await prisma.favorite.upsert({
    where: { userId_productId: { userId: req.user!.id, productId } },
    update: {},
    create: { userId: req.user!.id, productId },
  });
  res.status(201).json({ productId, isFavorite: true });
}));

router.delete('/:productId', asyncHandler(async (req: AuthRequest, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user!.id, productId: Number(req.params.productId) } });
  res.status(204).end();
}));

export default router;
