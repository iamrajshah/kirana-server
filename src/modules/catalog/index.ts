import { Router } from 'express';
import { CatalogController } from './catalog.controller';
import { extractTenant } from '@middlewares/tenant.middleware';
import { customerAuth } from '@middlewares/customer-auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { getProductsSchema, getProductByIdSchema, searchProductsSchema } from './catalog.validation';

const router = Router();
const controller = new CatalogController();

// Apply middlewares
router.use(extractTenant);
router.use(customerAuth);

router.get('/categories', controller.getCategories);
router.get('/products', validate(getProductsSchema), controller.getProducts);
router.get('/products/:id', validate(getProductByIdSchema), controller.getProductById);
router.get('/search', validate(searchProductsSchema), controller.searchProducts);

export default router;
