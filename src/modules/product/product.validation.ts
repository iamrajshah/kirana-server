import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(150),
    category_id: z.number().optional().nullable(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
  body: z
    .object({
      name: z.string().min(1).max(150).optional(),
      category_id: z.number().optional().nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field (name or category_id) must be provided',
    }),
});

export const getProductByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
});

export const updateProductStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
  body: z.object({
    is_active: z.boolean({
      required_error: 'is_active is required',
      invalid_type_error: 'is_active must be a boolean',
    }),
  }),
});

export const createVariantSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Product ID is required'),
  }),
  body: z.object({
    brand: z.string().max(100).optional().nullable(),
    size: z.string().max(50).optional().nullable(),
    packaging: z.enum(['PACKET', 'BOX', 'BOTTLE', 'LOOSE', 'KG']).optional().nullable(),
    price: z
      .number({
        required_error: 'Price is required',
        invalid_type_error: 'Price must be a number',
      })
      .min(0, 'Price must be non-negative'),
    selling_price: z.number().min(0).optional().nullable(),
    gst_percent: z.number().min(0).max(100).optional().nullable(),
    sku: z.string().max(50).optional().nullable(),
  }),
});

export const updateVariantSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Variant ID is required'),
  }),
  body: z
    .object({
      brand: z.string().max(100).optional().nullable(),
      size: z.string().max(50).optional().nullable(),
      packaging: z.enum(['PACKET', 'BOX', 'BOTTLE', 'LOOSE', 'KG']).optional().nullable(),
      price: z.number().min(0).optional(),
      selling_price: z.number().min(0).optional().nullable(),
      gst_percent: z.number().min(0).max(100).optional().nullable(),
      sku: z.string().max(50).optional().nullable(),
      is_active: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>['body'];
export type CreateVariantInput = z.infer<typeof createVariantSchema>['body'];
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>['body'];
