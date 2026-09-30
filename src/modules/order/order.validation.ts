import { z } from 'zod';

// GET /orders - Query params validation
export const getOrdersSchema = z.object({
  query: z.object({
    skip: z.string().optional(),
    take: z.string().optional(),
  }),
});

export type GetOrdersQueryInput = z.infer<typeof getOrdersSchema>['query'];

// GET /orders/:id - Params validation
export const getOrderByIdSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export type GetOrderByIdParamsInput = z.infer<typeof getOrderByIdSchema>['params'];

// PATCH /orders/:id/status - Update order status
export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    status: z.enum(['PLACED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
  }),
});

export type UpdateOrderStatusParamsInput = z.infer<typeof updateOrderStatusSchema>['params'];
export type UpdateOrderStatusBodyInput = z.infer<typeof updateOrderStatusSchema>['body'];
