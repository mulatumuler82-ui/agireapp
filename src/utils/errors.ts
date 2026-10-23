import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const asyncHandler =
  (fn: (req: any, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) return res.status(err.status).json({ message: err.message });
  if (err instanceof ZodError) {
    return res.status(422).json({
      message: err.issues[0]?.message || 'Validation failed',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err?.code === 'P2002') return res.status(409).json({ message: 'Already exists' });
  if (err?.code === 'P2025') return res.status(404).json({ message: 'Not found' });
  if (err?.name === 'MulterError') return res.status(400).json({ message: err.message });
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}
