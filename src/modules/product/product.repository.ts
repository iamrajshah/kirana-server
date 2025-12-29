import { prisma } from '@config/database';
import { Product, product_variants } from '@prisma/client';

export class ProductRepository {
  /**
   * Create a new product
   */
  async createProduct(data: {
    tenant_id: bigint;
    name: string;
    category_id?: bigint | null;
  }): Promise<Product> {
    return prisma.product.create({
      data: {
        tenant_id: data.tenant_id,
        name: data.name,
        category_id: data.category_id,
      },
    });
  }

  /**
   * Find product by ID and tenant
   */
  async findByIdAndTenant(id: bigint, tenant_id: bigint): Promise<Product | null> {
    return prisma.product.findFirst({
      where: {
        id,
        tenant_id,
      },
      include: {
        product_variants: {
          orderBy: {
            id: 'asc',
          },
        },
      },
    });
  }

  /**
   * Find product by name (case-insensitive) within tenant
   */
  async findByName(name: string, tenant_id: string): Promise<Product | null> {
    // Note: Using case-sensitive comparison for now. For case-insensitive, use raw SQL if needed.
    return prisma.product.findFirst({
      where: {
        tenant_id: BigInt(tenant_id),
        name: name,
      },
    });
  }

  /**
   * Find all products by tenant with pagination and search
   */
  async findAllByTenant(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      searchQuery?: string;
      includeInactive?: boolean;
    }
  ): Promise<{ products: Product[]; total: number }> {
    const where: any = {
      tenant_id,
    };

    // By default, only return active products
    if (!options?.includeInactive) {
      where.is_active = true;
    }

    if (options?.searchQuery) {
      where.name = {
        contains: options.searchQuery,
      };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          product_variants: {
            orderBy: {
              id: 'asc',
            },
          },
        },
        orderBy: {
          id: 'desc',
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  /**
   * Update product
   */
  async updateProduct(
    id: bigint,
    tenant_id: bigint,
    data: {
      name?: string;
      category_id?: bigint | null;
    }
  ): Promise<Product> {
    return prisma.product.update({
      where: {
        id,
        tenant_id,
      },
      data,
      include: {
        product_variants: true,
      },
    });
  }

  /**
   * Update product status
   */
  async updateStatus(
    id: bigint,
    tenant_id: bigint,
    is_active: boolean
  ): Promise<Product> {
    return prisma.product.update({
      where: {
        id,
        tenant_id,
      },
      data: {
        is_active,
      },
      include: {
        product_variants: true,
      },
    });
  }
}

export class VariantRepository {
  /**
   * Create a new variant
   */
  async createVariant(data: {
    tenant_id: bigint;
    product_id: bigint;
    brand?: string | null;
    size?: string | null;
    packaging?: string | null;
    price: number;
    gst_percent?: number | null;
    sku?: string | null;
  }): Promise<product_variants> {
    return prisma.product_variants.create({
      data: {
        tenant_id: data.tenant_id,
        product_id: data.product_id,
        brand: data.brand,
        size: data.size,
        packaging: data.packaging as any,
        price: data.price,
        gst_percent: data.gst_percent,
        sku: data.sku,
      },
    });
  }

  /**
   * Find variant by ID and tenant
   */
  async findByIdAndTenant(id: bigint, tenant_id: bigint): Promise<product_variants | null> {
    return prisma.product_variants.findFirst({
      where: {
        id,
        tenant_id,
      },
    });
  }

  /**
   * Find variant by SKU within tenant
   */
  async findBySKU(sku: string, tenant_id: string): Promise<product_variants | null> {
    return prisma.product_variants.findFirst({
      where: {
        tenant_id: BigInt(tenant_id),
        sku,
      },
    });
  }

  /**
   * Check if variant name (brand+size+packaging) exists for a product
   */
  async findByComposite(
    product_id: bigint,
    brand: string | null | undefined,
    size: string | null | undefined,
    packaging: string | null | undefined
  ): Promise<product_variants | null> {
    return prisma.product_variants.findFirst({
      where: {
        product_id,
        brand: brand || null,
        size: size || null,
        packaging: packaging as any,
      },
    });
  }

  /**
   * Update variant
   */
  async updateVariant(
    id: bigint,
    tenant_id: bigint,
    data: {
      brand?: string | null;
      size?: string | null;
      packaging?: string | null;
      price?: number;
      gst_percent?: number | null;
      sku?: string | null;
      is_active?: boolean;
    }
  ): Promise<product_variants> {
    return prisma.product_variants.update({
      where: {
        id,
        tenant_id,
      },
      data: {
        brand: data.brand,
        size: data.size,
        packaging: data.packaging as any,
        price: data.price,
        gst_percent: data.gst_percent,
        sku: data.sku,
        is_active: data.is_active,
      },
    });
  }
}
