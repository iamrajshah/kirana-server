import { Router } from 'express';
import authRoutes from '@modules/auth/auth.routes';
import userRoutes from '@modules/user/user.routes';
import customerRoutes from '@modules/customer/customer.routes';
import productRoutes from '@modules/product/product.routes';
import variantRoutes from '@modules/product/variant.routes';
import categoryRoutes from '@modules/category/category.routes';
import inventoryRoutes from '@modules/inventory/inventory.routes';
import invoiceRoutes from '@modules/invoice/invoice.routes';
import paymentRoutes from '@modules/payment/payment.routes';
import reportsRoutes from '@modules/reports/reports.routes';

const router = Router();

// API version 1 routes
// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/variants', variantRoutes);
router.use('/categories', categoryRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportsRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
