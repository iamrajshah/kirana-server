import { categories } from '@prisma/client';
import { CategoryRepository } from './category.repository';
import { CreateCategoryInput, UpdateCategoryInput } from './category.validation';
import { ConflictError, NotFoundError } from '@utils/errors';
import { AuditLogger } from '@utils/auditLogger';

export interface CategoryResponse {
  id: string;
  name: string | null;
  is_active: boolean;
}

export class CategoryService {
  private readonly repository: CategoryRepository;

  constructor() {
    this.repository = new CategoryRepository();
  }

  /**
   * Create a new category
   */
  async createCategory(
    tenantId: string,
    data: CreateCategoryInput,
    _createdBy: string
  ): Promise<CategoryResponse> {
    const tenantIdBigInt = BigInt(tenantId);

    // Check if category with same name already exists
    const existingCategory = await this.repository.findByName(data.name, tenantId);
    if (existingCategory) {
      throw new ConflictError('Category with this name already exists');
    }

    const category = await this.repository.createCategory({
      tenant_id: tenantIdBigInt,
      name: data.name,
    });

    // Audit log
    AuditLogger.create(
      tenantIdBigInt,
      BigInt(_createdBy),
      'category',
      category.id,
      { name: category.name, is_active: category.is_active }
    );

    return this.formatCategoryResponse(category);
  }

  /**
   * Get all categories with pagination
   */
  async getAllCategories(
    tenantId: string,
    page: number = 1,
    limit: number = 50,
    searchQuery?: string,
    includeInactive: boolean = false
  ): Promise<{ categories: CategoryResponse[]; total: number; page: number; limit: number }> {
    const tenantIdBigInt = BigInt(tenantId);
    const skip = (page - 1) * limit;

    const { categories, total } = await this.repository.findAllByTenant(tenantIdBigInt, {
      skip,
      take: limit,
      searchQuery,
      includeInactive,
    });

    return {
      categories: categories.map((c) => this.formatCategoryResponse(c)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId: string, tenantId: string): Promise<CategoryResponse> {
    const categoryIdBigInt = BigInt(categoryId);
    const tenantIdBigInt = BigInt(tenantId);

    const category = await this.repository.findByIdAndTenant(categoryIdBigInt, tenantIdBigInt);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return this.formatCategoryResponse(category);
  }

  /**
   * Update category
   */
  async updateCategory(
    categoryId: string,
    tenantId: string,
    data: UpdateCategoryInput,
    userId?: string
  ): Promise<CategoryResponse> {
    const categoryIdBigInt = BigInt(categoryId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if category exists
    const existingCategory = await this.repository.findByIdAndTenant(
      categoryIdBigInt,
      tenantIdBigInt
    );
    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    // If name is being updated, check for duplicates
    if (data.name && data.name !== existingCategory.name) {
      const nameExists = await this.repository.findByName(data.name, tenantId);
      if (nameExists && nameExists.id.toString() !== categoryId) {
        throw new ConflictError('Category with this name already exists');
      }
    }

    const updatedCategory = await this.repository.updateCategory(
      categoryIdBigInt,
      tenantIdBigInt,
      {
        name: data.name,
      }
    );

    // Audit log (only if userId is available)
    if (userId) {
      AuditLogger.update(
        tenantIdBigInt,
        BigInt(userId),
        'category',
        categoryIdBigInt,
        { name: existingCategory.name },
        { name: updatedCategory.name }
      );
    }

    return this.formatCategoryResponse(updatedCategory);
  }

  /**
   * Update category status
   */
  async updateCategoryStatus(
    categoryId: string,
    tenantId: string,
    is_active: boolean,
    userId?: string
  ): Promise<CategoryResponse> {
    const categoryIdBigInt = BigInt(categoryId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if category exists
    const existingCategory = await this.repository.findByIdAndTenant(
      categoryIdBigInt,
      tenantIdBigInt
    );
    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    const updatedCategory = await this.repository.updateStatus(
      categoryIdBigInt,
      tenantIdBigInt,
      is_active
    );

    // Audit log (only if userId is available)
    if (userId) {
      AuditLogger.statusChange(
        tenantIdBigInt,
        BigInt(userId),
        'category',
        categoryIdBigInt,
        { is_active: existingCategory.is_active, name: existingCategory.name },
        { is_active: updatedCategory.is_active, name: updatedCategory.name }
      );
    }

    return this.formatCategoryResponse(updatedCategory);
  }

  /**
   * Format category response
   */
  private formatCategoryResponse(category: categories): CategoryResponse {
    return {
      id: category.id.toString(),
      name: category.name,
      is_active: category.is_active,
    };
  }
}
