import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UnauthorizedError } from '@utils/errors';

export interface TenantRequest<P = any, B = any, Q = any> extends Request<P, any, B, Q> {
  tenantId: string;
  tenant: { id: bigint };
}

/**
 * Middleware to extract and validate tenantId from JWT
 * Must be used after authenticate middleware
 */
export const extractTenant = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!authReq.user.tenantId) {
      throw new UnauthorizedError('Tenant information missing from token');
    }

    // Attach tenantId and tenant object to request for easy access
    (req as TenantRequest).tenantId = authReq.user.tenantId;
    (req as any).tenant = { id: BigInt(authReq.user.tenantId) };

    next();
  } catch (error) {
    next(error);
  }
};
