import { z } from 'zod';

// GET /catalog/products - Query params validation
export const getProductsSchema = z.object({
  query: z.object({
    category_id: z.string().optional(),
    search: z.string().optional(),
    skip: z.string().optional(),
    take: z.string().optional(),
  }),
});

export type GetProductsQueryInput = z.infer<typeof getProductsSchema>['query'];

// GET /catalog/products/:id - Params validation
export const getProductByIdSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export type GetProductByIdParamsInput = z.infer<typeof getProductByIdSchema>['params'];
