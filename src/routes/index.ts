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
import importRoutes from '@modules/import/import.routes';
import dashboardRoutes from '@modules/dashboard/dashboard.routes';
import supplierRoutes from '@modules/supplier/supplier.routes';
import purchaseRoutes from '@modules/purchase/purchase.routes';

// Customer-facing routes
import customerAuthRoutes from '@modules/customer-auth/customer-auth.routes';
import catalogRoutes from '@modules/catalog/catalog.routes';
import cartRoutes from '@modules/cart/cart.routes';
import orderRoutes from '@modules/order/order.routes';

const router = Router();

// API version 1 routes
// Public routes
router.use('/auth', authRoutes);

// Customer-facing public/protected routes
router.use('/customer-auth', customerAuthRoutes);
router.use('/catalog', catalogRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);

// Protected POS routes
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/products', productRoutes);
router.use('/variants', variantRoutes);
router.use('/categories', categoryRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportsRoutes);
router.use('/import', importRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
