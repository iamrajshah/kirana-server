import { Router } from 'express';
import { CatalogController } from './catalog.controller';
import { extractTenant } from '@middlewares/tenant.middleware';
import { validate } from '@middlewares/validate.middleware';
import { getProductsSchema, getProductByIdSchema } from './catalog.validation';

const router = Router();
const controller = new CatalogController();

// Apply tenant middleware
router.use(extractTenant);

router.get('/categories', controller.getCategories);
router.get('/products', validate(getProductsSchema), controller.getProducts);
router.get('/products/:id', validate(getProductByIdSchema), controller.getProductById);

export default router;
