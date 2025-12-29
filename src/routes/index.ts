import { Router } from 'express';
import authRoutes from '@modules/auth/auth.routes';
import userRoutes from '@modules/user/user.routes';
import customerRoutes from '@modules/customer/customer.routes';
// TODO: Fix ledger module - currently commented out as Ledger/LedgerEntry models don't exist in schema
// import ledgerRoutes from '@modules/ledger/ledger.routes';

const router = Router();

// API version 1 routes
// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
// router.use('/ledgers', ledgerRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
