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
          price: z.number().positive('Price must be positive'),
        })
      )
      .min(1, 'At least one item is required'),
    gst_amount: z.number().nonnegative('GST amount must be non-negative').optional().default(0),
    invoice_url: z.string().url('Invalid invoice URL').optional(),
    idempotency_key: z.string().optional(), // Optional client-provided idempotency key in body
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
