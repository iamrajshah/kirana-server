import { z } from 'zod';

/**
 * Validation schema for barcode lookup (local + external)
 * GET /api/products/barcode/:barcode/lookup
 */
export const barcodeLookupSchema = z.object({
  params: z.object({
    barcode: z
      .string()
      .trim()
      .min(6, 'Barcode must be at least 6 characters')
      .max(20, 'Barcode must not exceed 20 characters'),
  }),
});

/**
 * Validation schema for scanning a barcode (local only)
 * GET /api/products/barcode/:barcode
 */
export const scanBarcodeSchema = z.object({
  params: z.object({
    barcode: z.string().min(1, 'Barcode is required').max(50, 'Barcode too long'),
  }),
});

/**
 * Validation schema for creating a product using barcode
 * POST /api/products/barcode
 */
export const createProductFromBarcodeSchema = z.object({
  body: z.object({
    barcode: z.string().min(1, 'Barcode is required').max(50, 'Barcode too long'),
    
    productMaster: z.object({
      name: z.string().min(1, 'Product master name is required').max(255),
      brand: z.string().max(150).optional().nullable(),
      categoryName: z.string().max(150).optional().nullable(),
    }),
    
    product: z.object({
      name: z.string().min(1, 'Product name is required').max(150),
      categoryId: z.number().optional().nullable(),
    }),
    
    variant: z.object({
      sku: z.string().max(50).optional().nullable(),
      mrp: z.number().min(0, 'MRP must be non-negative'),
      sellingPrice: z.number().min(0, 'Selling price must be non-negative'),
      unit: z.string().max(10).optional().nullable(),
      unitValue: z.number().min(0).optional().nullable(),
    }),
    
    inventory: z.object({
      quantity: z.number().int().min(0, 'Quantity must be non-negative'),
    }),
  }),
});

export type BarcodeLookupParams = z.infer<typeof barcodeLookupSchema>['params'];
export type ScanBarcodeParams = z.infer<typeof scanBarcodeSchema>['params'];
export type CreateProductFromBarcodeInput = z.infer<typeof createProductFromBarcodeSchema>['body'];
