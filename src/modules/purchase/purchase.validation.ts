import { z } from 'zod';

const purchaseItemSchema = z.object({
  variant_id: z.number().positive('Variant ID must be positive'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unit_price: z.number().positive('Unit price must be positive'),
});

export const createPurchaseSchema = z.object({
  body: z.object({
    supplier_id: z.number().positive('Supplier ID is required'),
    invoice_number: z.string().max(100).optional(),
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
    payment_amount: z.number().min(0, 'Payment amount cannot be negative').optional().default(0),
    payment_mode: z.enum(['CASH', 'UPI', 'CARD', 'BANK']).optional(),
  }).refine(
    (data) => {
      // If payment_amount > 0, payment_mode is required
      if (data.payment_amount > 0 && !data.payment_mode) {
        return false;
      }
      return true;
    },
    {
      message: 'Payment mode is required when payment amount is provided',
      path: ['payment_mode'],
    }
  ),
});

export const getPurchaseByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Purchase ID is required'),
  }),
});

export const getPurchasesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    supplier_id: z.string().regex(/^\d+$/).optional(),
    status: z.enum(['PAID', 'UNPAID', 'PARTIAL']).optional(),
  }),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>['body'];
export type PurchaseItem = z.infer<typeof purchaseItemSchema>;
