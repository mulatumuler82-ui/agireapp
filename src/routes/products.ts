import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth';
import { ApiError, asyncHandler } from '../utils/errors';

const router = Router();
router.use(requireAuth);

const productSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  price: z.coerce.number().positive('Price must be greater than 0'),
  unit: z.string().trim().min(1).max(20),
  quantityAvailable: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
  categoryId: z.coerce.number().int(),
  imageUrl: z.string().url().nullable().optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
});

const querySchema = z.object({
  search: z.string().trim().optional(),
  category: z.coerce.number().int().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  mine: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const include = {
  category: true,
  seller: { select: { id: true, name: true, phone: true, avatarUrl: true, address: true } },
} satisfies Prisma.ProductInclude;

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const q = querySchema.parse(req.query);
  const where: Prisma.ProductWhereInput = {
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: 'insensitive' as const } },
            { description: { contains: q.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(q.category ? { categoryId: q.category } : {}),
    ...(q.minPrice !== undefined || q.maxPrice !== undefined ? { price: { gte: q.minPrice, lte: q.maxPrice } } : {}),
    ...(q.mine === 'true' ? { sellerId: req.user!.id } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    q.sort === 'price_asc' ? { price: 'asc' } : q.sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' };

  const [total, rows, favs] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy, include, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.favorite.findMany({ where: { userId: req.user!.id }, select: { productId: true } }),
  ]);
  const favSet = new Set(favs.map((f) => f.productId));
  res.json({
    data: rows.map((p) => ({ ...p, isFavorite: favSet.has(p.id) })),
    page: q.page,
    limit: q.limit,
    total,
    totalPages: Math.ceil(total / q.limit),
  });
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, include });
  if (!product) throw new ApiError(404, 'Product not found');
  const fav = await prisma.favorite.findUnique({ where: { userId_productId: { userId: req.user!.id, productId: id } } });
  res.json({ ...product, isFavorite: !!fav });
}));

router.post('/', requireRole('FARMER'), asyncHandler(async (req: AuthRequest, res) => {
  const data = productSchema.parse(req.body);
  const product = await prisma.product.create({ data: { ...data, sellerId: req.user!.id }, include });
  res.status(201).json(product);
}));

async function ownProduct(id: number, userId: number) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new ApiError(404, 'Product not found');
  if (p.sellerId !== userId) throw new ApiError(403, 'You can only change your own products');
  return p;
}

router.put('/:id', requireRole('FARMER'), asyncHandler(async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await ownProduct(id, req.user!.id);
  const data = productSchema.partial().parse(req.body);
  res.json(await prisma.product.update({ where: { id }, data, include }));
}));

router.delete('/:id', requireRole('FARMER'), asyncHandler(async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await ownProduct(id, req.user!.id);
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used > 0) throw new ApiError(409, 'This product has orders and cannot be deleted. Set its quantity to 0 instead.');
  await prisma.product.delete({ where: { id } });
  res.status(204).end();
}));

export default router;
