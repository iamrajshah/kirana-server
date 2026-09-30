import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { AppError } from '@utils/errors';

export interface CustomerRequest<P = any, B = any, Q = any> extends Request<P, any, B, Q> {
  tenant: { id: bigint };
  customer: { id: bigint };
}

interface CustomerJwtPayload {
  customerId: string;
  tenantId: string;
  type: string;
}

export const customerAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authorization token provided', 401);
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, env.JWT_SECRET) as CustomerJwtPayload;

    if (decoded.type !== 'customer') {
      throw new AppError('Invalid token type', 401);
    }

    // Add tenant and customer to request
    (req as any).tenant = { id: BigInt(decoded.tenantId) };
    (req as any).customer = { id: BigInt(decoded.customerId) };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired token', 401));
    } else {
      next(error);
    }
  }
};
