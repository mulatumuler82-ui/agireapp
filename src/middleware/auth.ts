import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: { id: number; role: 'FARMER' | 'BUYER' };
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new ApiError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as any;
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

export const requireRole =
  (role: 'FARMER' | 'BUYER') => (req: AuthRequest, _res: Response, next: NextFunction) =>
    req.user?.role === role ? next() : next(new ApiError(403, `Only ${role.toLowerCase()}s can do this`));
