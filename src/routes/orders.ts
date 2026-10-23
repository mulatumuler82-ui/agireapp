import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth';
import { ApiError, asyncHandler } from '../utils/errors';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  deliveryAddress: z.string().trim().min(5, 'Enter a delivery address'),
  items: z.array(z.object({ productId: z.number().int(), quantity: z.number().int().min(1) })).min(1, 'Cart is empty'),
});

const include = {
  items: { include: { product: { select: { id: true, title: true, unit: true, imageUrl: true } } } },
  buyer: { select: { id: true, name: true, phone: true } },
  seller: { select: { id: true, name: true, phone: true } },
};

// Seller-driven transitions; buyers may only cancel a PENDING order.
const sellerFlow: Record<string, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
};

const notify = (userId: number, title: string, body: string) =>
  prisma.notification.create({ data: { userId, title, body } });

router.post('/', requireRole('BUYER'), asyncHandler(async (req: AuthRequest, res) => {
  const { items, deliveryAddress } = createSchema.parse(req.body);
  const buyerId = req.user!.id;

  const orders = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
    const bySeller = new Map<number, { productId: number; quantity: number; unitPrice: number }[]>();

    for (const item of items) {
      const p = products.find((x) => x.id === item.productId);
      if (!p) throw new ApiError(404, `Product ${item.productId} not found`);
      if (p.sellerId === buyerId) throw new ApiError(400, 'You cannot buy your own product');
      if (p.quantityAvailable < item.quantity) throw new ApiError(409, `Only ${p.quantityAvailable} ${p.unit} of "${p.title}" left`);
      await tx.product.update({ where: { id: p.id }, data: { quantityAvailable: { decrement: item.quantity } } });
      const list = bySeller.get(p.sellerId) ?? [];
      list.push({ productId: p.id, quantity: item.quantity, unitPrice: p.price });
      bySeller.set(p.sellerId, list);
    }

    const created = [];
    for (const [sellerId, lines] of bySeller) {
      const order = await tx.order.create({
        data: {
          buyerId, sellerId, deliveryAddress,
          totalPrice: lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
          items: { create: lines },
        },
        include,
      });
      await tx.notification.create({ data: { userId: sellerId, title: 'New order', body: `You received order #${order.id}` } });
      created.push(order);
    }
    return created;
  });
  res.status(201).json(orders);
}));

router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const where = req.user!.role === 'FARMER' ? { sellerId: req.user!.id } : { buyerId: req.user!.id };
  res.json(await prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' } }));
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.buyerId !== req.user!.id && order.sellerId !== req.user!.id) throw new ApiError(403, 'Not your order');
  res.json(order);
}));

router.patch('/:id/status', asyncHandler(async (req: AuthRequest, res) => {
  const { status } = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);
  const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include });
  if (!order) throw new ApiError(404, 'Order not found');

  const isSeller = order.sellerId === req.user!.id;
  const isBuyer = order.buyerId === req.user!.id;
  if (!isSeller && !isBuyer) throw new ApiError(403, 'Not your order');

  const allowed: OrderStatus[] = isSeller ? sellerFlow[order.status] ?? [] : order.status === 'PENDING' ? ['CANCELLED'] : [];
  if (!allowed.includes(status)) throw new ApiError(400, `Cannot change order from ${order.status} to ${status}`);

  const updated = await prisma.$transaction(async (tx) => {
    if (status === 'REJECTED' || status === 'CANCELLED') {
      for (const it of order.items) {
        await tx.product.update({ where: { id: it.productId }, data: { quantityAvailable: { increment: it.quantity } } });
      }
    }
    return tx.order.update({ where: { id: order.id }, data: { status }, include });
  });

  const target = isSeller ? order.buyerId : order.sellerId;
  await notify(target, `Order #${order.id} ${status.toLowerCase()}`, `Order #${order.id} is now ${status.toLowerCase()}.`);
  res.json(updated);
}));

export default router;
