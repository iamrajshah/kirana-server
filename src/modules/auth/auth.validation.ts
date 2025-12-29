import { z } from 'zod';

/**
 * Register Owner Schema - Creates tenant and owner user
 */
export const registerOwnerSchema = z.object({
  body: z.object({
    // Tenant details
    shopName: z.string().min(1, 'Shop name is required').max(100),
    ownerName: z.string().min(1, 'Owner name is required').max(100),
    phone: z
      .string()
      .min(10, 'Phone number must be at least 10 digits')
      .max(15)
      .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format'),
    email: z.string().email('Invalid email format').max(100).optional(),
    gstNumber: z.string().max(20).optional(),
    
    // User credentials
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
  }),
});

/**
 * Login Schema
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').optional(),
    phone: z.string().optional(),
    password: z.string().min(1, 'Password is required'),
  }).refine(
    (data) => data.email || data.phone,
    {
      message: 'Either email or phone is required',
      path: ['email'],
    }
  ),
});

/**
 * Refresh Token Schema
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export type RegisterOwnerInput = z.infer<typeof registerOwnerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
