# Authentication Module

## Overview

This module implements JWT-based authentication and role-based authorization for a multi-tenant SaaS application.

## Features

- ✅ Owner registration with tenant creation
- ✅ User login with email or phone
- ✅ JWT token generation (access + refresh tokens)
- ✅ Role-based authorization (OWNER, MANAGER, CASHIER)
- ✅ Multi-tenant isolation
- ✅ Password hashing with bcrypt
- ✅ Token refresh mechanism

## Folder Structure

```
src/modules/auth/
├── auth.validation.ts    # Zod validation schemas
├── auth.repository.ts    # Database operations
├── auth.service.ts       # Business logic
├── auth.controller.ts    # Request handlers
└── auth.routes.ts        # Route definitions
```

## API Endpoints

### 1. Register Owner

**POST** `/api/v1/auth/register-owner`

Creates a new tenant (shop) and owner user.

**Request Body:**
```json
{
  "shopName": "My Kirana Store",
  "ownerName": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "gstNumber": "29ABCDE1234F1Z5",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Owner registered successfully",
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "tenantId": "1",
      "roles": ["OWNER"]
    },
    "tenant": {
      "id": "1",
      "name": "My Kirana Store",
      "status": "ACTIVE"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

### 2. Login

**POST** `/api/v1/auth/login`

Authenticate user with email/phone and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

OR

```json
{
  "phone": "+919876543210",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "tenantId": "1",
      "roles": ["OWNER"]
    },
    "tenant": {
      "id": "1",
      "name": "My Kirana Store",
      "status": "ACTIVE"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

### 3. Refresh Token

**POST** `/api/v1/auth/refresh-token`

Get a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

## Middleware

### 1. Authentication Middleware

Validates JWT token and attaches user info to request.

**Usage:**
```typescript
import { authenticate } from '@middlewares/auth.middleware';

router.use(authenticate);
```

### 2. Authorization Middleware

Checks if user has required roles.

**Usage:**
```typescript
import { authorize } from '@middlewares/auth.middleware';

// Single role
router.delete('/customers/:id', authorize('OWNER'), controller.delete);

// Multiple roles (OR condition)
router.post('/customers', authorize('OWNER', 'MANAGER'), controller.create);
```

## Role Permissions

### OWNER
- Full access to all resources
- Can create/manage users
- Can assign roles
- Can manage products, inventory, invoices, customers, payments

### MANAGER
- Can manage products, inventory, invoices
- Can view/create/update customers
- Cannot delete customers
- Cannot manage users or roles

### CASHIER
- Can create invoices
- Can accept payments
- Can view customers
- Read-only access to products and inventory

## Security Features

1. **Password Hashing**: Uses bcrypt with configurable rounds (default: 10)
2. **Token Expiry**: 
   - Access Token: 7 days (configurable)
   - Refresh Token: 30 days (configurable)
3. **Tenant Isolation**: All operations scoped to user's tenant
4. **Account Status**: Checks for active user and tenant
5. **Strong Password Policy**: 
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number

## Environment Variables

```env
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_ROUNDS=10
```

## Database Setup

Before using the auth module, seed the roles:

```bash
npm run prisma:generate
npx ts-node prisma/seed-roles.ts
```

## Usage Example

### Protecting Routes

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';

const router = Router();

// Public route
router.post('/auth/login', authController.login);

// Protected route (authenticated users only)
router.get('/profile', authenticate, profileController.get);

// Role-based route (OWNER only)
router.delete('/users/:id', 
  authenticate, 
  authorize('OWNER'), 
  userController.delete
);

// Multiple roles (OWNER or MANAGER)
router.post('/products', 
  authenticate, 
  authorize('OWNER', 'MANAGER'), 
  productController.create
);
```

### Accessing User Info

```typescript
import { AuthRequest } from '@middlewares/auth.middleware';

export const getProfile = async (req: Request, res: Response) => {
  const { user } = req as AuthRequest;
  
  console.log(user.userId);    // "1"
  console.log(user.tenantId);  // "1"
  console.log(user.email);     // "john@example.com"
  console.log(user.roles);     // ["OWNER"]
};
```

## Error Handling

Common error responses:

**401 Unauthorized - No token:**
```json
{
  "success": false,
  "message": "No token provided"
}
```

**401 Unauthorized - Invalid credentials:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**401 Unauthorized - Insufficient permissions:**
```json
{
  "success": false,
  "message": "Access denied. Required roles: OWNER"
}
```

**409 Conflict - Duplicate email:**
```json
{
  "success": false,
  "message": "Email already registered"
}
```

## Testing

Test the authentication flow:

```bash
# 1. Register owner
curl -X POST http://localhost:3000/api/v1/auth/register-owner \
  -H "Content-Type: application/json" \
  -d '{
    "shopName": "Test Store",
    "ownerName": "Test Owner",
    "phone": "+919876543210",
    "email": "test@example.com",
    "password": "Test1234"
  }'

# 2. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'

# 3. Access protected route
curl -X GET http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer <your-access-token>"
```

## Future Enhancements

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Two-factor authentication (2FA)
- [ ] Session management
- [ ] Login history/audit logs
- [ ] Rate limiting on auth endpoints
- [ ] OAuth integration (Google, Facebook)
