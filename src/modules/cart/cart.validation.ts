import { z } from 'zod';

// POST /cart/add - Add item to cart
export const addCartItemSchema = z.object({
  body: z.object({
    variant_id: z.string().or(z.number()),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  }),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>['body'];

// PUT /cart/update - Update cart item
export const updateCartItemSchema = z.object({
  body: z.object({
    item_id: z.string().min(1, 'Item ID is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  }),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>['body'];

// DELETE /cart/remove/:itemId - Remove cart item
export const removeCartItemSchema = z.object({
  params: z.object({
    itemId: z.string(),
  }),
});

export type RemoveCartItemParamsInput = z.infer<typeof removeCartItemSchema>['params'];

