import { Request, Response } from 'express';
import { ProductService } from './product.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import {
  CreateProductInput,
  UpdateProductInput,
  UpdateProductStatusInput,
  CreateVariantInput,
  UpdateVariantInput,
} from './product.validation';

export class ProductController {
  private readonly productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  /**
   * Get all products
   */
  getAllProducts = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const result = await this.productService.getAllProducts(tenantId, page, limit, search, includeInactive);

    return res.json({
      success: true,
      data: result.products,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  });

  /**
   * Get product by ID
   */
  getProductById = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;

    const product = await this.productService.getProductById(id, tenantId);

    return res.json({
      success: true,
      data: product,
    });
  });

  /**
   * Create a new product
   */
  createProduct = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const data = req.body as CreateProductInput;

    const product = await this.productService.createProduct(tenantId, data, user!.userId);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  });

  /**
   * Update a product
   */
  updateProduct = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const data = req.body as UpdateProductInput;

    const product = await this.productService.updateProduct(id, tenantId, data, user?.userId);

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  });

  /**
   * Update product status
   */
  updateProductStatus = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const { is_active } = req.body as UpdateProductStatusInput;

    const product = await this.productService.updateProductStatus(id, tenantId, is_active, user?.userId);

    return res.json({
      success: true,
      message: 'Product status updated successfully',
      data: product,
    });
  });

  /**
   * Create a variant for a product
   */
  createVariant = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const data = req.body as CreateVariantInput;

    const variant = await this.productService.createVariant(id, tenantId, data, user!.userId);

    return res.status(201).json({
      success: true,
      message: 'Variant created successfully',
      data: variant,
    });
  });

  /**
   * Update a variant
   */
  updateVariant = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const data = req.body as UpdateVariantInput;

    const variant = await this.productService.updateVariant(id, tenantId, data, user?.userId);

    return res.json({
      success: true,
      message: 'Variant updated successfully',
      data: variant,
    });
  });

  /**
   * Search products for billing screen
   * Optimized for quick product lookup with inventory data
   */
  searchForBilling = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    console.log('🎯 Controller reached - searchForBilling');
    console.log('📋 Full request query object:', JSON.stringify(req.query, null, 2));
    
    const { tenantId } = req as TenantRequest;
    const searchQuery = (req.query.q as string) || '';
    const trimmedQuery = searchQuery.trim();

    console.log('🔑 Query processing:', {
      tenantId,
      rawQuery: searchQuery,
      rawLength: searchQuery.length,
      trimmedQuery: trimmedQuery,
      trimmedLength: trimmedQuery.length,
      willPass: trimmedQuery.length >= 2,
    });

    if (!trimmedQuery || trimmedQuery.length < 2) {
      console.log('⚠️ Query validation failed - too short');
      return res.json({
        success: true,
        data: [],
        message: 'Search query must be at least 2 characters',
      });
    }

    console.log('✅ Query validated, calling service...');
    const results = await this.productService.searchForBilling(tenantId, trimmedQuery);

    console.log('📤 Sending response:', { count: results.length });
    return res.json({
      success: true,
      data: results,
    });
  });
}
