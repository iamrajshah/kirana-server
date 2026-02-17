# Permission-Based Authorization System

## Overview

This system implements fine-grained permission-based authorization where:
- **Roles** define a user's position (OWNER, MANAGER, CASHIER)
- **Permissions** define specific actions (USER_CREATE, BILL_CREATE, etc.)
- Roles are mapped to permissions **in-memory** (no database hits)
- JWT token carries roles → permissions are derived on each request

## Architecture Flow

```
Request
  ↓
JWT Middleware (validates token, extracts roles)
  ↓
req.user = { userId, tenantId, roles, permissions }
  ↓
Permission Middleware (checks if user.permissions includes required permission)
  ↓
Controller
```

## Role-Permission Mapping

### OWNER
Full system access with all permissions:
- **User Management**: `USER_CREATE`, `USER_VIEW`, `USER_UPDATE`, `USER_DELETE`
- **Billing**: `BILL_CREATE`, `BILL_VIEW`, `BILL_UPDATE`, `BILL_DELETE`
- **Customers**: `CUSTOMER_CREATE`, `CUSTOMER_VIEW`, `CUSTOMER_UPDATE`, `CUSTOMER_DELETE`
- **Products**: `PRODUCT_CREATE`, `PRODUCT_VIEW`, `PRODUCT_UPDATE`, `PRODUCT_DELETE`
- **Settings**: `SETTINGS_ALL`

### MANAGER
Can manage products, inventory, and invoices:
- **Billing**: `BILL_CREATE`, `BILL_VIEW`, `BILL_UPDATE`
- **Customers**: `CUSTOMER_CREATE`, `CUSTOMER_VIEW`, `CUSTOMER_UPDATE`
- **Products**: `PRODUCT_CREATE`, `PRODUCT_VIEW`, `PRODUCT_UPDATE`, `PRODUCT_DELETE`

### CASHIER
Limited to creating invoices and viewing data:
- **Billing**: `BILL_CREATE`, `BILL_VIEW`
- **Customers**: `CUSTOMER_VIEW`
- **Products**: `PRODUCT_VIEW`

## Available Permissions

### User Management
- `USER_CREATE` - Create new users
- `USER_VIEW` - View user details
- `USER_UPDATE` - Update user information
- `USER_DELETE` - Delete users

### Billing/Invoices
- `BILL_CREATE` - Create new bills/invoices
- `BILL_VIEW` - View bills/invoices
- `BILL_UPDATE` - Update bills/invoices
- `BILL_DELETE` - Delete bills/invoices

### Customer Management
- `CUSTOMER_CREATE` - Create new customers
- `CUSTOMER_VIEW` - View customer details
- `CUSTOMER_UPDATE` - Update customer information
- `CUSTOMER_DELETE` - Delete customers

### Product Management
- `PRODUCT_CREATE` - Create new products
- `PRODUCT_VIEW` - View product details
- `PRODUCT_UPDATE` - Update product information
- `PRODUCT_DELETE` - Delete products

### Settings
- `SETTINGS_ALL` - Full access to system settings

## Middleware Usage

### 1. Single Permission Check

```typescript
import { hasPermission } from '@middlewares/auth.middleware';

// Only users with USER_CREATE permission can access
router.post('/users', 
  authenticate, 
  hasPermission('USER_CREATE'), 
  controller.create
);
```

### 2. Multiple Permissions (ALL required)

```typescript
import { hasAllPermissions } from '@middlewares/auth.middleware';

// User must have BOTH permissions
router.post('/bulk-update', 
  authenticate, 
  hasAllPermissions('PRODUCT_UPDATE', 'PRODUCT_DELETE'), 
  controller.bulkUpdate
);
```

### 3. Multiple Permissions (ANY required)

```typescript
import { hasAnyPermission } from '@middlewares/auth.middleware';

// User needs at least ONE of these permissions
router.get('/reports', 
  authenticate, 
  hasAnyPermission('BILL_VIEW', 'SETTINGS_ALL'), 
  controller.getReports
);
```

### 4. Role-Based (Legacy, not recommended)

```typescript
import { authorize } from '@middlewares/auth.middleware';

// Use permission-based instead for better granularity
router.delete('/users/:id', 
  authenticate, 
  authorize('OWNER'), 
  controller.delete
);
```

## Implementation Example

### Route Definition

```typescript
import { Router } from 'express';
import { authenticate, hasPermission } from '@middlewares/auth.middleware';

const router = Router();

router.get('/', 
  authenticate, 
  hasPermission('CUSTOMER_VIEW'), 
  customerController.getAll
);

router.post('/', 
  authenticate, 
  hasPermission('CUSTOMER_CREATE'), 
  customerController.create
);

router.delete('/:id', 
  authenticate, 
  hasPermission('CUSTOMER_DELETE'), 
  customerController.delete
);
```

### Controller Access

```typescript
import { Request, Response } from 'express';
import { AuthRequest } from '@middlewares/auth.middleware';

export const getProfile = async (req: Request, res: Response) => {
  const { user } = req as AuthRequest;
  
  console.log(user.userId);        // "123"
  console.log(user.tenantId);      // "1"
  console.log(user.roles);         // ["OWNER"]
  console.log(user.permissions);   // ["USER_CREATE", "BILL_CREATE", ...]
  
  // Check if user has specific permission
  if (user.permissions?.includes('SETTINGS_ALL')) {
    // User can access settings
  }
};
```

## Performance Considerations

### Why No Database Hits?

1. **Speed**: Permission checks happen on every protected route
2. **Scalability**: No DB load for authorization
3. **Simplicity**: Permissions derived from JWT roles

### How It Works

1. User logs in → Roles fetched from DB → Stored in JWT
2. On each request:
   - JWT validated
   - Roles extracted from token
   - Permissions computed from in-memory `ROLE_PERMISSIONS` map
   - No database query needed!

### Trade-offs

**Pros:**
- ✅ Fast (no DB hits)
- ✅ Scalable (stateless)
- ✅ Simple to implement

**Cons:**
- ❌ Permission changes require re-login
- ❌ Can't revoke permissions without token expiry

## Adding New Permissions

1. **Define the permission** in `auth.middleware.ts`:

```typescript
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    'USER_CREATE', 'USER_VIEW', 'USER_UPDATE', 'USER_DELETE',
    'INVENTORY_CREATE', // ← New permission
    // ... rest
  ],
  MANAGER: [
    'INVENTORY_CREATE', // ← New permission
    // ... rest
  ],
};
```

2. **Use in routes**:

```typescript
router.post('/inventory', 
  authenticate, 
  hasPermission('INVENTORY_CREATE'), 
  inventoryController.create
);
```

## Security Best Practices

### 1. Always authenticate first

```typescript
// ✅ Correct
router.post('/products', authenticate, hasPermission('PRODUCT_CREATE'), controller.create);

// ❌ Wrong - permission check without authentication
router.post('/products', hasPermission('PRODUCT_CREATE'), controller.create);
```

### 2. Use specific permissions

```typescript
// ✅ Better - granular control
router.delete('/users/:id', authenticate, hasPermission('USER_DELETE'), controller.delete);

// ❌ Avoid - too broad
router.delete('/users/:id', authenticate, authorize('OWNER'), controller.delete);
```

### 3. Combine with tenant isolation

```typescript
// ✅ Correct - ensures tenant isolation
router.use(authenticate);
router.use(extractTenant); // Validates user belongs to tenant
router.get('/', hasPermission('CUSTOMER_VIEW'), controller.getAll);
```

## Testing Permissions

### Test User Permissions

```bash
# 1. Register as OWNER
curl -X POST http://localhost:3000/api/v1/auth/register-owner \
  -H "Content-Type: application/json" \
  -d '{
    "shopName": "Test Store",
    "ownerName": "Owner User",
    "phone": "+919876543210",
    "email": "owner@test.com",
    "password": "Owner1234"
  }'

# Response includes token with roles: ["OWNER"]
# Permissions: [ALL_PERMISSIONS]

# 2. Try accessing protected endpoint
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone": "+919999999999"
  }'
```

### Test Permission Denied

```bash
# If CASHIER tries to delete customer (requires CUSTOMER_DELETE)
curl -X DELETE http://localhost:3000/api/v1/customers/1 \
  -H "Authorization: Bearer CASHIER_TOKEN"

# Response: 401 Unauthorized
# { "success": false, "message": "Access denied. Required permission: CUSTOMER_DELETE" }
```

## Error Responses

### No Token

```json
{
  "success": false,
  "message": "No token provided"
}
```

### Invalid Token

```json
{
  "success": false,
  "message": "Invalid token"
}
```

### Missing Permission

```json
{
  "success": false,
  "message": "Access denied. Required permission: USER_DELETE"
}
```

### Missing Multiple Permissions

```json
{
  "success": false,
  "message": "Access denied. Required permissions: PRODUCT_UPDATE, PRODUCT_DELETE"
}
```

## Extending the System

### Custom Permission Logic

```typescript
// Create custom middleware for complex permission logic
export const canManageOwnProfile = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const targetUserId = req.params.userId;
  
  // User can manage their own profile OR has USER_UPDATE permission
  if (authReq.user?.userId === targetUserId || 
      authReq.user?.permissions?.includes('USER_UPDATE')) {
    return next();
  }
  
  throw new UnauthorizedError('Cannot manage this profile');
};

router.put('/users/:userId/profile', 
  authenticate, 
  canManageOwnProfile, 
  controller.updateProfile
);
```

## Migration from Role-Based to Permission-Based

### Before (Role-Based)

```typescript
router.post('/customers', authorize('OWNER', 'MANAGER'), controller.create);
```

### After (Permission-Based)

```typescript
router.post('/customers', hasPermission('CUSTOMER_CREATE'), controller.create);
```

**Benefits:**
- More granular control
- Easier to modify permissions without changing roles
- Better separation of concerns
- Self-documenting (route shows exact permission needed)
