import { Request, Response } from 'express';
import { CategoryService } from './category.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { CreateCategoryInput, UpdateCategoryInput, UpdateCategoryStatusInput } from './category.validation';

export class CategoryController {
  private readonly categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  /**
   * Get all categories
   */
  getAllCategories = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const result = await this.categoryService.getAllCategories(tenantId, page, limit, search, includeInactive);

    return res.json({
      success: true,
      data: result.categories,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  });

  /**
   * Get category by ID
   */
  getCategoryById = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { id } = req.params;

    const category = await this.categoryService.getCategoryById(id, tenantId);

    return res.json({
      success: true,
      data: category,
    });
  });

  /**
   * Create a new category
   */
  createCategory = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const data = req.body as CreateCategoryInput;

    const category = await this.categoryService.createCategory(tenantId, data, user!.userId);

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  });

  /**
   * Update a category
   */
  updateCategory = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const data = req.body as UpdateCategoryInput;

    const category = await this.categoryService.updateCategory(id, tenantId, data, user?.userId);

    return res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  });

  /**
   * Update category status
   */
  updateCategoryStatus = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const { is_active } = req.body as UpdateCategoryStatusInput;

    const category = await this.categoryService.updateCategoryStatus(id, tenantId, is_active, user?.userId);

    return res.json({
      success: true,
      message: 'Category status updated successfully',
      data: category,
    });
  });
}
