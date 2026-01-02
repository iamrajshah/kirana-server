import { z } from 'zod';

/**
 * Create User Schema
 */
export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    phone: z
      .string()
      .min(10, 'Phone number must be at least 10 digits')
      .max(15)
      .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format'),
    email: z.string().email('Invalid email format').max(100).optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    role: z.enum(['MANAGER', 'CASHIER'], {
      required_error: 'Role is required',
      invalid_type_error: 'Role must be either MANAGER or CASHIER',
    }),
  }),
});

/**
 * Update User Status Schema
 */
export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    is_active: z.boolean({
      required_error: 'Status is required',
      invalid_type_error: 'Status must be a boolean',
    }),
  }),
});

/**
 * Get User by ID Schema
 */
export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

/**
 * Update Own Profile Schema
 */
export const updateOwnProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(1, 'Name cannot be empty').max(100).optional(),
      phone: z
        .string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15)
        .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format')
        .optional(),
      email: z.string().email('Invalid email format').max(100).optional(),
    })
    .refine(
      (data) => data.name !== undefined || data.phone !== undefined || data.email !== undefined,
      {
        message: 'At least one field (name, phone, or email) must be provided',
      }
    ),
});

/**
 * Change Own Password Schema
 */
export const changeOwnPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(100)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'New password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>['body'];
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>['body'];
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>['body'];
