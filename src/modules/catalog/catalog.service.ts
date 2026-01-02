import { CatalogRepository } from './catalog.repository';
import { AppError } from '@utils/errors';

interface GetProductsFilters {
  category_id?: bigint;
  search?: string;
  skip: number;
  take: number;
}

export class CatalogService {
  private readonly repository: CatalogRepository;

  constructor() {
    this.repository = new CatalogRepository();
  }

  async getCategories(tenantId: bigint) {
    return this.repository.getCategories(tenantId);
  }

  async getProducts(tenantId: bigint, filters: GetProductsFilters) {
    const { products, total } = await this.repository.getProducts(tenantId, filters);

    return {
      products,
      pagination: {
        total,
        skip: filters.skip,
        take: filters.take,
      },
    };
  }

  async getProductById(tenantId: bigint, productId: bigint) {
    const product = await this.repository.getProductById(tenantId, productId);

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }
}
