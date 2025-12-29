/**
 * Example User Management Module with Permission-Based Authorization
 * 
 * This demonstrates how to build a complete CRUD module using the permission system
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, hasPermission, AuthRequest } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { asyncHandler } from '@utils/asyncHandler';

// ============================================================================
// ROUTES EXAMPLE
// ============================================================================

const router = Router();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

/**
 * GET /users
 * Permission: USER_VIEW
 * Who can access: OWNER only
 */
router.get('/', 
  hasPermission('USER_VIEW'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    
    // Access user info and permissions
    console.log('User ID:', user?.userId);
    console.log('Tenant ID:', user?.tenantId);
    console.log('Roles:', user?.roles);
    console.log('Permissions:', user?.permissions);
    
    // Your business logic here
    return res.json({
      success: true,
      data: {
        message: 'List of users',
        user: {
          id: user?.userId,
          roles: user?.roles,
          permissions: user?.permissions,
        },
      },
    });
  })
);

/**
 * POST /users
 * Permission: USER_CREATE
 * Who can access: OWNER only
 */
router.post('/', 
  hasPermission('USER_CREATE'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    
    // Only OWNER can create users
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      createdBy: user?.userId,
    });
  })
);

/**
 * PUT /users/:id
 * Permission: USER_UPDATE
 * Who can access: OWNER only
 */
router.put('/:id', 
  hasPermission('USER_UPDATE'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { id } = req.params;
    
    return res.json({
      success: true,
      message: `User ${id} updated successfully`,
      updatedBy: user?.userId,
    });
  })
);

/**
 * DELETE /users/:id
 * Permission: USER_DELETE
 * Who can access: OWNER only
 */
router.delete('/:id', 
  hasPermission('USER_DELETE'), 
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { id } = req.params;
    
    // Prevent self-deletion
    if (user?.userId === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }
    
    return res.json({
      success: true,
      message: `User ${id} deleted successfully`,
      deletedBy: user?.userId,
    });
  })
);

// ============================================================================
// ADVANCED EXAMPLES
// ============================================================================

/**
 * Example 1: Multiple permissions (user needs ALL)
 */
import { hasAllPermissions } from '@middlewares/auth.middleware';

router.post('/users/bulk-delete', 
  hasAllPermissions('USER_VIEW', 'USER_DELETE'), 
  asyncHandler(async (req: Request, res: Response) => {
    // User must have BOTH USER_VIEW and USER_DELETE permissions
    return res.json({ success: true });
  })
);

/**
 * Example 2: Multiple permissions (user needs ANY)
 */
import { hasAnyPermission } from '@middlewares/auth.middleware';

router.get('/reports/users', 
  hasAnyPermission('USER_VIEW', 'SETTINGS_ALL'), 
  asyncHandler(async (req: Request, res: Response) => {
    // User needs either USER_VIEW OR SETTINGS_ALL permission
    return res.json({ success: true });
  })
);

/**
 * Example 3: Custom permission logic in controller
 */
router.put('/users/:id/profile', 
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { id } = req.params;
    
    // User can update own profile OR has USER_UPDATE permission
    const canUpdate = 
      user?.userId === id || 
      user?.permissions?.includes('USER_UPDATE');
    
    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
      });
    }
    
    return res.json({
      success: true,
      message: 'Profile updated',
    });
  })
);

/**
 * Example 4: Check permissions in service layer
 */
class UserService {
  async updateUser(
    userId: string, 
    currentUserId: string, 
    userPermissions: string[],
    data: any
  ) {
    // Business logic with permission checks
    if (userId !== currentUserId && !userPermissions.includes('USER_UPDATE')) {
      throw new Error('Insufficient permissions');
    }
    
    // Update user...
    return { success: true };
  }
  
  async deleteUser(
    userId: string, 
    currentUserId: string, 
    userPermissions: string[]
  ) {
    // Prevent self-deletion
    if (userId === currentUserId) {
      throw new Error('Cannot delete your own account');
    }
    
    // Check permission
    if (!userPermissions.includes('USER_DELETE')) {
      throw new Error('Insufficient permissions');
    }
    
    // Delete user...
    return { success: true };
  }
}

// ============================================================================
// TESTING EXAMPLES
// ============================================================================

/**
 * Test different role permissions
 */

// OWNER tests
const ownerTests = {
  // ✓ OWNER has USER_CREATE
  createUser: 'POST /users → Success',
  
  // ✓ OWNER has USER_VIEW
  viewUsers: 'GET /users → Success',
  
  // ✓ OWNER has USER_DELETE
  deleteUser: 'DELETE /users/123 → Success',
  
  // ✓ OWNER has all permissions
  allPermissions: [
    'USER_CREATE', 'USER_VIEW', 'USER_UPDATE', 'USER_DELETE',
    'BILL_CREATE', 'BILL_VIEW', 'BILL_UPDATE', 'BILL_DELETE',
    'CUSTOMER_CREATE', 'CUSTOMER_VIEW', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
    'PRODUCT_CREATE', 'PRODUCT_VIEW', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
    'SETTINGS_ALL',
  ],
};

// MANAGER tests
const managerTests = {
  // ✗ MANAGER does NOT have USER_CREATE
  createUser: 'POST /users → 401 Unauthorized (Access denied. Required permission: USER_CREATE)',
  
  // ✓ MANAGER has CUSTOMER_CREATE
  createCustomer: 'POST /customers → Success',
  
  // ✓ MANAGER has PRODUCT_UPDATE
  updateProduct: 'PUT /products/123 → Success',
  
  // ✗ MANAGER does NOT have USER_DELETE
  deleteUser: 'DELETE /users/123 → 401 Unauthorized',
};

// CASHIER tests
const cashierTests = {
  // ✗ CASHIER does NOT have CUSTOMER_CREATE
  createCustomer: 'POST /customers → 401 Unauthorized (Access denied. Required permission: CUSTOMER_CREATE)',
  
  // ✓ CASHIER has CUSTOMER_VIEW
  viewCustomers: 'GET /customers → Success',
  
  // ✓ CASHIER has BILL_CREATE
  createBill: 'POST /bills → Success',
  
  // ✗ CASHIER does NOT have CUSTOMER_DELETE
  deleteCustomer: 'DELETE /customers/123 → 401 Unauthorized',
};

// ============================================================================
// PERMISSION MATRIX REFERENCE
// ============================================================================

const PERMISSION_MATRIX = {
  USER_CREATE: ['OWNER'],
  USER_VIEW: ['OWNER'],
  USER_UPDATE: ['OWNER'],
  USER_DELETE: ['OWNER'],
  
  BILL_CREATE: ['OWNER', 'MANAGER', 'CASHIER'],
  BILL_VIEW: ['OWNER', 'MANAGER', 'CASHIER'],
  BILL_UPDATE: ['OWNER', 'MANAGER'],
  BILL_DELETE: ['OWNER'],
  
  CUSTOMER_CREATE: ['OWNER', 'MANAGER'],
  CUSTOMER_VIEW: ['OWNER', 'MANAGER', 'CASHIER'],
  CUSTOMER_UPDATE: ['OWNER', 'MANAGER'],
  CUSTOMER_DELETE: ['OWNER'],
  
  PRODUCT_CREATE: ['OWNER', 'MANAGER'],
  PRODUCT_VIEW: ['OWNER', 'MANAGER', 'CASHIER'],
  PRODUCT_UPDATE: ['OWNER', 'MANAGER'],
  PRODUCT_DELETE: ['OWNER', 'MANAGER'],
  
  SETTINGS_ALL: ['OWNER'],
};

export default router;
