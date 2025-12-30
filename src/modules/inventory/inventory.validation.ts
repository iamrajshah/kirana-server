import { z } from 'zod';

export const getInventoryByVariantIdSchema = z.object({
  params: z.object({
    variantId: z.string().min(1, 'Variant ID is required'),
  }),
});

export const updateInventorySchema = z.object({
  params: z.object({
    variantId: z.string().min(1, 'Variant ID is required'),
  }),
  body: z.object({
    quantity: z.number().int().min(0, 'Quantity must be non-negative'),
    low_stock_threshold: z.number().int().min(0).optional(),
  }),
});

export const adjustInventorySchema = z.object({
  params: z.object({
    variantId: z.string().min(1, 'Variant ID is required'),
  }),
  body: z.object({
    adjustment: z.number().int('Adjustment must be an integer'),
    reason: z.string().min(1).max(255).optional(),
  }),
});
