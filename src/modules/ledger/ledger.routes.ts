import { Router } from 'express';
import { LedgerController } from './ledger.controller';
import { authenticate } from '@middlewares/auth.middleware';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import {
  createLedgerSchema,
  updateLedgerSchema,
  getLedgerByIdSchema,
  getLedgerBalanceSchema,
} from './ledger.validation';

const router = Router();
const controller = new LedgerController();

// All routes require authentication and tenant extraction
router.use(authenticate);
router.use(extractTenant);

// Routes
router.get('/', controller.getAll);
router.get('/:id', validate(getLedgerByIdSchema), controller.getById);
router.get('/:id/entries', validate(getLedgerByIdSchema), controller.getEntries);
router.get('/:id/balance', validate(getLedgerBalanceSchema), controller.getBalance);
router.post('/', validate(createLedgerSchema), controller.create);
router.put('/:id', validate(updateLedgerSchema), controller.update);
router.delete('/:id', validate(getLedgerByIdSchema), controller.delete);

export default router;
