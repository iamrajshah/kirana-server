import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UnauthorizedError } from '@utils/errors';

export interface TenantRequest<P = any, B = any, Q = any> extends Request<P, any, B, Q> {
  tenantId: string;
  tenant: { id: bigint };
}

/**
 * Middleware to extract and validate tenantId from JWT or request body/header
 * For authenticated routes: Extracts from JWT
 * For unauthenticated routes (register/login): Extracts from x-tenant-id header or body
 */
export const extractTenant = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authReq = req as AuthRequest;
    let tenantId: string | undefined;

    // First, try to get tenant from JWT (for authenticated routes)
    if (authReq.user && authReq.user.tenantId) {
      tenantId = authReq.user.tenantId;
    } 
    // If no JWT, try x-tenant-id header (for unauthenticated routes)
    else if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'] as string;
    }
    // Finally, try body.tenant_id (for register/login)
    else if (req.body && req.body.tenant_id) {
      tenantId = req.body.tenant_id.toString();
    }

    if (!tenantId) {
      throw new UnauthorizedError('Tenant information required');
    }

    // Attach tenantId and tenant object to request for easy access
    (req as TenantRequest).tenantId = tenantId;
    (req as any).tenant = { id: BigInt(tenantId) };

    next();
  } catch (error) {
    next(error);
  }
};
