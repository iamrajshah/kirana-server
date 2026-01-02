import { z } from 'zod';

// POST /cart/items - Add item to cart
export const addCartItemSchema = z.object({
  body: z.object({
    variant_id: z.string().or(z.number()),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  }),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>['body'];

// PUT /cart/items/:id - Update cart item
export const updateCartItemSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  }),
});

export type UpdateCartItemParamsInput = z.infer<typeof updateCartItemSchema>['params'];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>['body'];

// DELETE /cart/items/:id - Remove cart item
export const removeCartItemSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export type RemoveCartItemParamsInput = z.infer<typeof removeCartItemSchema>['params'];

