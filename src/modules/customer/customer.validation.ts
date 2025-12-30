import { z } from 'zod';

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email').max(100).optional().nullable(),
    phone: z.string().min(10, 'Phone must be at least 10 characters').max(15),
    opening_balance: z.number().optional().default(0),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().max(100).optional().nullable(),
      phone: z.string().min(10).max(15).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field (name, email, or phone) must be provided',
    }),
});

export const getCustomerByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
});

export const addOpeningBalanceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
  body: z.object({
    amount: z.number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    }),
    description: z.string().max(255).optional().default('Opening balance'),
  }),
});

export const getCustomerLedgerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('50'),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>['body'];
export type AddOpeningBalanceInput = z.infer<typeof addOpeningBalanceSchema>['body'];
