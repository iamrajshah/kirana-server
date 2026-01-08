import { z } from 'zod';

export const customerRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    email: z.string().email('Invalid email').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const customerLoginSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>['body'];
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>['body'];
