import { z } from 'zod';

export const createImportJobSchema = z.object({
  body: z.object({
    type: z.enum(['CUSTOMER', 'PRODUCT', 'INVENTORY', 'CATEGORY'], {
      required_error: 'Import type is required',
    }),
    autoCreateCategories: z.boolean().optional().default(false),
  }),
});

export const getImportJobSchema = z.object({
  params: z.object({
    jobId: z.string().regex(/^\d+$/, 'Invalid job ID'),
  }),
});

export const commitImportJobSchema = z.object({
  params: z.object({
    jobId: z.string().regex(/^\d+$/, 'Invalid job ID'),
  }),
});

export const getImportJobsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
    type: z.enum(['CUSTOMER', 'PRODUCT', 'INVENTORY', 'CATEGORY']).optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  }),
});

export const exportDataSchema = z.object({
  body: z.object({
    type: z.enum(['CUSTOMER', 'PRODUCT', 'INVENTORY', 'CATEGORY'], {
      required_error: 'Export type is required',
    }),
    format: z.enum(['CSV', 'EXCEL']).optional().default('CSV'),
  }),
});

export const exportFormatSchema = z.object({
  query: z.object({
    format: z.enum(['CSV', 'EXCEL']).optional().default('CSV'),
  }),
});

export type CreateImportJobInput = z.infer<typeof createImportJobSchema>['body'];
export type GetImportJobInput = z.infer<typeof getImportJobSchema>['params'];
export type CommitImportJobInput = z.infer<typeof commitImportJobSchema>['params'];
export type GetImportJobsInput = z.infer<typeof getImportJobsSchema>['query'];
export type ExportDataInput = z.infer<typeof exportDataSchema>['body'];
export type ExportFormatInput = z.infer<typeof exportFormatSchema>['query'];
