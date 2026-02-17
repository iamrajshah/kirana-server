import { z } from 'zod';

export const createBankAccountSchema = z.object({
  params: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
  }),
  body: z.object({
    account_holder_name: z
      .string()
      .min(1, 'Account holder name is required')
      .max(150, 'Account holder name too long'),
    bank_name: z.string().min(1, 'Bank name is required').max(150, 'Bank name too long'),
    account_number: z
      .string()
      .min(1, 'Account number is required')
      .max(50, 'Account number too long'),
    ifsc_code: z
      .string()
      .min(11, 'IFSC code must be 11 characters')
      .max(11, 'IFSC code must be 11 characters')
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
    branch_name: z.string().max(150, 'Branch name too long').optional().nullable(),
    account_type: z.string().max(20, 'Account type too long').optional().nullable(),
    is_primary: z.boolean().optional(),
  }),
});

export const updateBankAccountSchema = z.object({
  params: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    bankAccountId: z.string().min(1, 'Bank account ID is required'),
  }),
  body: z
    .object({
      account_holder_name: z.string().min(1).max(150).optional(),
      bank_name: z.string().min(1).max(150).optional(),
      account_number: z.string().min(1).max(50).optional(),
      ifsc_code: z
        .string()
        .min(11)
        .max(11)
        .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format')
        .optional(),
      branch_name: z.string().max(150).optional().nullable(),
      account_type: z.string().max(20).optional().nullable(),
      is_primary: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const getBankAccountByIdSchema = z.object({
  params: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    bankAccountId: z.string().min(1, 'Bank account ID is required'),
  }),
});

export const getBankAccountsSchema = z.object({
  params: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
  }),
});

export const setPrimaryBankAccountSchema = z.object({
  params: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    bankAccountId: z.string().min(1, 'Bank account ID is required'),
  }),
});

export const deleteBankAccountSchema = z.object({
  params: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    bankAccountId: z.string().min(1, 'Bank account ID is required'),
  }),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>['body'];
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>['body'];
