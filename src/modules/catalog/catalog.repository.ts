import { prisma } from '@config/database';

interface GetProductsFilters {
  category_id?: bigint;
  search?: string;
  skip: number;
  take: number;
}

export class CatalogRepository {
  /**
   * Get all active categories
   */
  async getCategories(tenantId: bigint) {
    return prisma.categories.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get products with variants
   */
  async getProducts(tenantId: bigint, filters: GetProductsFilters) {
    const where: any = {
      tenant_id: tenantId,
      is_active: true,
    };

    if (filters.category_id) {
      where.category_id = filters.category_id;
    }

    if (filters.search) {
      where.name = {
        contains: filters.search,
      };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          image_url: true,
          category_id: true,
          categories: {
            select: {
              id: true,
              name: true,
            },
          },
          product_variants: {
            where: {
              is_active: true,
            },
            select: {
              id: true,
              brand: true,
              size: true,
              packaging: true,
              selling_price: true,
              mrp_price: true,
              sku: true,
              image_url: true,
              inventory: {
                select: {
                  quantity: true,
                },
              },
            },
            orderBy: {
              selling_price: 'asc',
            },
          },
        },
        skip: filters.skip,
        take: filters.take,
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  /**
   * Get product by ID
   */
  async getProductById(tenantId: bigint, productId: bigint) {
    return prisma.product.findFirst({
      where: {
        id: productId,
        tenant_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        image_url: true,
        category_id: true,
        categories: {
          select: {
            id: true,
            name: true,
          },
        },
        product_variants: {
          where: {
            is_active: true,
          },
          select: {
            id: true,
            brand: true,
            size: true,
            packaging: true,
            selling_price: true,
            mrp_price: true,
            price: true,
            sku: true,
            image_url: true,
            gst_percent: true,
            inventory: {
              select: {
                quantity: true,
                low_stock_threshold: true,
              },
            },
          },
        },
      },
    });
  }
}
