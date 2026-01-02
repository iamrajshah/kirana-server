import { Request, Response } from 'express';
import { CatalogService } from './catalog.service';
import { asyncHandler } from '@utils/asyncHandler';
import { TenantRequest } from '@middlewares/tenant.middleware';

export class CatalogController {
  private readonly catalogService: CatalogService;

  constructor() {
    this.catalogService = new CatalogService();
  }

  /**
   * Get categories - GET /catalog/categories
   */
  getCategories = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenant } = req as unknown as TenantRequest;
    const tenantId = tenant.id;

    const categories = await this.catalogService.getCategories(tenantId);

    return res.status(200).json({
      success: true,
      data: categories,
    });
  });

  /**
   * Get products - GET /catalog/products
   */
  getProducts = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant } = req as unknown as TenantRequest;
      const tenantId = tenant.id;
      const { category_id, search, skip = 0, take = 50 } = req.query;

      const products = await this.catalogService.getProducts(tenantId, {
        category_id: category_id ? BigInt(String(category_id)) : undefined,
        search: search as string | undefined,
        skip: Number(skip),
        take: Number(take),
      });

      return res.status(200).json({
        success: true,
        data: products,
      });
    }
  );

  /**
   * Get product details - GET /catalog/products/:id
   */
  getProductById = asyncHandler(
    async (req: Request, res: Response): Promise<Response> => {
      const { tenant } = req as unknown as TenantRequest;
      const tenantId = tenant.id;
      const productId = BigInt(req.params.id);

      const product = await this.catalogService.getProductById(tenantId, productId);

      return res.status(200).json({
        success: true,
        data: product,
      });
    }
  );
}
