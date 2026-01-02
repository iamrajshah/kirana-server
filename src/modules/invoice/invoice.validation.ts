import { z } from 'zod';

export const createInvoiceSchema = z.object({
  headers: z.object({
    'idempotency-key': z.string().optional(),
  }).passthrough(), // Allow other headers
  body: z.object({
    customer_id: z.string().min(1, 'Customer ID is required'),
    items: z
      .array(
        z.object({
          variant_id: z.string().min(1, 'Variant ID is required'),
          quantity: z.number().int().positive('Quantity must be positive'),
          price: z.number().positive('Price must be positive').optional(), // Optional - can override selling price
          discount_amount: z.number().nonnegative('Discount amount must be non-negative').optional().default(0),
        })
      )
      .min(1, 'At least one item is required'),
    gst_amount: z.number().nonnegative('GST amount must be non-negative').optional().default(0),
    discount_amount: z.number().nonnegative('Bill-level discount must be non-negative').optional().default(0),
    invoice_url: z.string().url('Invalid invoice URL').optional(),
    idempotency_key: z.string().optional(), // Optional client-provided idempotency key in body
    status: z.enum(['DRAFT', 'FINALIZED']).optional().default('DRAFT'), // Default to DRAFT
  }),
});

export const updateInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
  body: z.object({
    customer_id: z.string().optional(),
    items: z
      .array(
        z.object({
          variant_id: z.string().min(1, 'Variant ID is required'),
          quantity: z.number().int().positive('Quantity must be positive'),
          price: z.number().positive('Price must be positive').optional(),
          discount_amount: z.number().nonnegative('Discount amount must be non-negative').optional().default(0),
        })
      )
      .optional(),
    gst_amount: z.number().nonnegative('GST amount must be non-negative').optional(),
    discount_amount: z.number().nonnegative('Bill-level discount must be non-negative').optional(),
    invoice_url: z.string().url('Invalid invoice URL').optional(),
  }),
});

export const finalizeInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});

export const cancelInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const getInvoiceByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});

export const getCustomerInvoicesSchema = z.object({
  params: z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
  }),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>['body'];
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>['body'];
export type FinalizeInvoiceInput = z.infer<typeof finalizeInvoiceSchema>['params'];
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>['body'];
