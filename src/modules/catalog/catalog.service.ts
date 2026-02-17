import { CatalogRepository } from './catalog.repository';
import { AppError } from '@utils/errors';
import { serializeBigInt } from '@utils/serializeBigInt';

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
    const categories = await this.repository.getCategories(tenantId);
    return serializeBigInt(categories);
  }

  async getProducts(tenantId: bigint, filters: GetProductsFilters) {
    const { products, total } = await this.repository.getProducts(tenantId, filters);

    // Default fallback image - use a simple, reliable placeholder
    const fallbackImage = 'https://placehold.co/300x300/png';

    // Transform products to match UI expectations
    const transformedProducts = products.map((product: any) => {
      const variants = product.product_variants?.map((variant: any) => {
        // Convert Prisma Decimal to number
        const sellingPrice = variant.selling_price ? Number(variant.selling_price) : 0;
        const mrpPrice = variant.mrp_price ? Number(variant.mrp_price) : 0;
        const quantity = variant.inventory?.quantity !== undefined ? Number(variant.inventory.quantity) : 0;

        const variantImageUrl = variant.image_url || product.image_url || fallbackImage;

        return {
          id: variant.id.toString(),
          brand: variant.brand || '',
          size: variant.size || '',
          packaging: variant.packaging || '',
          selling_price: sellingPrice,
          mrp_price: mrpPrice,
          sku: variant.sku || '',
          unit: variant.size || variant.packaging || 'unit',
          quantity: quantity,
          image_url: variantImageUrl,
        };
      }) || [];

      const productImageUrl = product.image_url || (variants.length > 0 && variants[0].image_url) || fallbackImage;

      return {
        id: product.id.toString(),
        name: product.name,
        image_url: productImageUrl,
        category_id: product.category_id?.toString(),
        category_name: product.categories?.name,
        variants,
      };
    }).filter(p => p.variants.length > 0);

    return {
      products: transformedProducts,
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

    return serializeBigInt(product);
  }
}
