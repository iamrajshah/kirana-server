import { z } from 'zod';

export const createLedgerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    code: z.string().min(1, 'Code is required').max(50),
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], {
      required_error: 'Type is required',
    }),
    category: z.string().max(100).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
  }),
});

export const updateLedgerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    code: z.string().min(1).max(50).optional(),
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
    category: z.string().max(100).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const getLedgerByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Ledger ID is required'),
  }),
});

export const getLedgerBalanceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Ledger ID is required'),
  }),
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export type CreateLedgerInput = z.infer<typeof createLedgerSchema>['body'];
export type UpdateLedgerInput = z.infer<typeof updateLedgerSchema>['body'];
