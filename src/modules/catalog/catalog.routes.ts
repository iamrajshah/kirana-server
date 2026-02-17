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

/**
 * @route   GET /catalog/categories
 * @desc    Get all categories
 * @access  Customer authenticated
 */
router.get('/categories', controller.getCategories);

/**
 * @route   GET /catalog/products
 * @desc    Get products with optional filters
 * @access  Customer authenticated
 */
router.get('/products', validate(getProductsSchema), controller.getProducts);

/**
 * @route   GET /catalog/products/:id
 * @desc    Get product by ID
 * @access  Customer authenticated
 */
router.get('/products/:id', validate(getProductByIdSchema), controller.getProductById);

/**
 * @route   GET /catalog/search
 * @desc    Search products
 * @access  Customer authenticated
 */
router.get('/search', validate(searchProductsSchema), controller.searchProducts);

export default router;
