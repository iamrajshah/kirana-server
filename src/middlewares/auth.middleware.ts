import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@config/env';
import { UnauthorizedError } from '@utils/errors';

/**
 * Role-Permission Mapping
 * Defines what permissions each role has
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: ['USER_CREATE', 'USER_VIEW', 'USER_UPDATE', 'USER_DELETE', 'BILL_CREATE', 'BILL_VIEW', 'BILL_UPDATE', 'BILL_DELETE', 'CUSTOMER_CREATE', 'CUSTOMER_VIEW', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE', 'PRODUCT_CREATE', 'PRODUCT_VIEW', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'REPORT_VIEW', 'SETTINGS_ALL'],
  MANAGER: ['BILL_CREATE', 'BILL_VIEW', 'BILL_UPDATE', 'CUSTOMER_CREATE', 'CUSTOMER_VIEW', 'CUSTOMER_UPDATE', 'PRODUCT_CREATE', 'PRODUCT_VIEW', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'REPORT_VIEW'],
  CASHIER: ['BILL_CREATE', 'BILL_VIEW', 'CUSTOMER_VIEW', 'PRODUCT_VIEW'],
};

/**
 * Get all permissions for given roles
 */
export const getPermissionsForRoles = (roles: string[]): string[] => {
  const permissions = new Set<string>();
  
  roles.forEach((role) => {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    rolePermissions.forEach((permission) => permissions.add(permission));
  });
  
  return Array.from(permissions);
};

export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string | null;
  roles: string[];
}

export interface AuthRequest extends Request {
  user?: JWTPayload & {
    permissions?: string[];
  };
}

/**
 * Middleware to verify JWT token and extract user information
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

      // Attach user info to request with permissions derived from roles
      const permissions = getPermissionsForRoles(decoded.roles);
      
      (req as AuthRequest).user = {
        ...decoded,
        permissions,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const userRoles = authReq.user.roles || [];

      // Check if user has any of the allowed roles
      const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

      if (!hasPermission) {
        throw new UnauthorizedError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has specific role
 */
export const hasRole = (userRoles: string[], role: string): boolean => {
  return userRoles.includes(role);
};

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (userRoles: string[], roles: string[]): boolean => {
  return roles.some((role) => userRoles.includes(role));
};

/*

/**
 * Permission-based authorization middleware
 * @param requiredPermission - The permission required to access the route
 */
export const hasPermission = (requiredPermission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const userPermissions = authReq.user.permissions || [];

      // Check if user has the required permission
      if (!userPermissions.includes(requiredPermission)) {
        throw new UnauthorizedError(
          `Access denied. Required permission: ${requiredPermission}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Multiple permissions check (user must have ALL permissions)
 * @param requiredPermissions - Array of permissions required
 */
export const hasAllPermissions = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const userPermissions = authReq.user.permissions || [];

      // Check if user has all required permissions
      const hasAll = requiredPermissions.every((permission) =>
        userPermissions.includes(permission)
      );

      if (!hasAll) {
        throw new UnauthorizedError(
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Multiple permissions check (user must have ANY of the permissions)
 * @param requiredPermissions - Array of permissions (user needs at least one)
 */
export const hasAnyPermission = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const userPermissions = authReq.user.permissions || [];

      // Check if user has any of the required permissions
      const hasAny = requiredPermissions.some((permission) =>
        userPermissions.includes(permission)
      );

      if (!hasAny) {
        throw new UnauthorizedError(
          `Access denied. Required one of: ${requiredPermissions.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
/*
 * Check if user has all of the specified roles
 */
export const hasAllRoles = (userRoles: string[], roles: string[]): boolean => {
  return roles.every((role) => userRoles.includes(role));
};
