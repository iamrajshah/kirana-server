import { z } from 'zod';

export const salesReportSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    groupBy: z.enum(['day', 'week', 'month']).optional(),
  }),
});

export const dailyCashbookSchema = z.object({
  query: z.object({
    date: z.string().optional(), // YYYY-MM-DD format
  }),
});

export const profitLossSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});
