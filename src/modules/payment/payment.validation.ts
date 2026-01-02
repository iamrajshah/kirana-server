import { z } from 'zod';

export const createPaymentSchema = z.object({
  headers: z.object({
    'idempotency-key': z.string().optional(),
  }).passthrough(), // Allow other headers
  body: z.object({
    customer_id: z.string().min(1, 'Customer ID is required'),
    amount: z.number().positive('Amount must be positive'),
    payment_mode: z.enum(['CASH', 'UPI', 'CARD', 'BANK', 'ADJUSTMENT'], {
      required_error: 'Payment mode is required',
    }),
    invoice_id: z.string().optional(),
    reference_note: z.string().max(255, 'Reference note must be at most 255 characters').optional(),
    idempotency_key: z.string().optional(), // Optional client-provided idempotency key in body
  }),
});

export const getPaymentByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Payment ID is required'),
  }),
});

export const getCustomerPaymentsSchema = z.object({
  params: z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
  }),
});

// Customer-facing schemas
export const createPaymentIntentSchema = z.object({
  body: z.object({
    invoice_id: z.string().min(1, 'Invoice ID is required'),
    amount: z.number().positive('Amount must be positive'),
  }),
});

export const getPaymentsByInvoiceSchema = z.object({
  query: z.object({
    invoiceId: z.string().min(1, 'Invoice ID is required'),
  }),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>['body'];
export type GetPaymentsByInvoiceInput = z.infer<typeof getPaymentsByInvoiceSchema>['query'];
