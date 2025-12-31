import { z } from 'zod';

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    phone: z.string().min(10, 'Phone must be at least 10 characters').max(20).optional().nullable(),
    email: z.string().email('Invalid email').max(255).optional().nullable(),
    address: z.string().optional().nullable(),
    opening_balance: z.number().optional(),
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
  body: z
    .object({
      name: z.string().min(1).max(255).optional(),
      phone: z.string().min(10).max(20).optional().nullable(),
      email: z.string().email().max(255).optional().nullable(),
      address: z.string().max(1000).optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const getSupplierByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
});

export const addOpeningBalanceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
  body: z.object({
    amount: z.number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    }).positive('Amount must be positive'),
  }),
});

export const getSupplierLedgerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
  }),
});

export const makePaymentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
  body: z.object({
    amount: z.number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    }).positive('Amount must be positive'),
    payment_mode: z.enum(['CASH', 'UPI', 'CARD', 'BANK'], {
      required_error: 'Payment mode is required',
    }),
    notes: z.string().max(255).optional(),
  }),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>['body'];
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>['body'];
export type AddOpeningBalanceInput = z.infer<typeof addOpeningBalanceSchema>['body'];
export type MakePaymentInput = z.infer<typeof makePaymentSchema>['body'];
