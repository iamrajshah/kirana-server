import { prisma } from '@config/database';
import { product_barcodes, product_master, Product, product_variants, Inventory } from '@prisma/client';

/**
 * Type for barcode scan result with full product details
 */
export type BarcodeProductResult = product_barcodes & {
  product_variants: product_variants & {
    products: Product & {
      categories: {
        id: bigint;
        name: string | null;
        is_active: boolean;
      } | null;
    };
    inventory: Inventory | null;
  };
};

/**
 * Repository for barcode-based product operations
 */
export class ProductBarcodeRepository {
  /**
   * Find barcode by barcode value and tenant
   */
  async findBarcodeByTenantAndValue(
    tenantId: bigint,
    barcode: string
  ): Promise<BarcodeProductResult | null> {
    return prisma.product_barcodes.findFirst({
      where: {
        tenant_id: tenantId,
        barcode: barcode,
        is_active: true,
      },
      include: {
        product_variants: {
          include: {
            products: {
              include: {
                categories: {
                  select: {
                    id: true,
                    name: true,
                    is_active: true,
                  },
                },
              },
            },
            inventory: true,
          },
        },
      },
    });
  }

  /**
   * Find product master by name and brand (case-insensitive)
   */
  async findProductMasterByNameAndBrand(
    name: string,
    brand?: string | null
  ): Promise<product_master | null> {
    return prisma.product_master.findFirst({
      where: {
        name: name,
        brand: brand || null,
      },
    });
  }

  /**
   * Create product master
   */
  async createProductMaster(data: {
    name: string;
    brand?: string | null;
    category_name?: string | null;
  }): Promise<product_master> {
    return prisma.product_master.create({
      data: {
        name: data.name,
        brand: data.brand,
        category_name: data.category_name,
      },
    });
  }

  /**
   * Create product with product master relationship
   */
  async createProduct(data: {
    tenant_id: bigint;
    product_master_id: bigint;
    name: string;
    category_id?: bigint | null;
  }): Promise<Product> {
    return prisma.product.create({
      data: {
        tenant_id: data.tenant_id,
        name: data.name,
        category_id: data.category_id,
        product_master_id: data.product_master_id,
      },
    });
  }

  /**
   * Create product variant
   */
  async createVariant(data: {
    tenant_id: bigint;
    product_id: bigint;
    sku?: string | null;
    mrp_price: number;
    selling_price: number;
    size?: string | null;
  }): Promise<product_variants> {
    return prisma.product_variants.create({
      data: {
        tenant_id: data.tenant_id,
        product_id: data.product_id,
        sku: data.sku,
        mrp_price: data.mrp_price,
        selling_price: data.selling_price,
        price: data.selling_price, // Use selling_price as default price
        size: data.size,
      },
    });
  }

  /**
   * Create barcode entry
   */
  async createBarcode(data: {
    tenant_id: bigint;
    variant_id: bigint;
    barcode: string;
  }): Promise<product_barcodes> {
    return prisma.product_barcodes.create({
      data: {
        tenant_id: data.tenant_id,
        variant_id: data.variant_id,
        barcode: data.barcode,
      },
    });
  }

  /**
   * Create inventory record
   */
  async createInventory(data: {
    tenant_id: bigint;
    variant_id: bigint;
    quantity: number;
  }): Promise<Inventory> {
    return prisma.inventory.create({
      data: {
        tenant_id: data.tenant_id,
        variant_id: data.variant_id,
        quantity: data.quantity,
      },
    });
  }

  /**
   * Execute transaction for creating complete product with barcode
   */
  async createProductWithBarcode(
    productMasterData: {
      name: string;
      brand?: string | null;
      category_name?: string | null;
    },
    productData: {
      tenant_id: bigint;
      name: string;
      category_id?: bigint | null;
    },
    variantData: {
      tenant_id: bigint;
      sku?: string | null;
      mrp_price: number;
      selling_price: number;
      size?: string | null;
    },
    barcodeValue: string,
    quantity: number,
    existingProductMaster?: product_master
  ) {
    return prisma.$transaction(async (tx) => {
      // Step 1: Find or create product master
      let productMaster: product_master;
      if (existingProductMaster) {
        productMaster = existingProductMaster;
      } else {
        productMaster = await tx.product_master.create({
          data: {
            name: productMasterData.name,
            brand: productMasterData.brand,
            category_name: productMasterData.category_name,
          },
        });
      }

      // Step 2: Create product
      const product = await tx.product.create({
        data: {
          tenant_id: productData.tenant_id,
          name: productData.name,
          category_id: productData.category_id,
          product_master_id: productMaster.id,
        },
      });

      // Step 3: Create variant
      const variant = await tx.product_variants.create({
        data: {
          tenant_id: variantData.tenant_id,
          product_id: product.id,
          sku: variantData.sku,
          mrp_price: variantData.mrp_price,
          selling_price: variantData.selling_price,
          price: variantData.selling_price,
          size: variantData.size,
        },
      });

      // Step 4: Create barcode
      const barcode = await tx.product_barcodes.create({
        data: {
          tenant_id: productData.tenant_id,
          variant_id: variant.id,
          barcode: barcodeValue,
        },
      });

      // Step 5: Create inventory
      const inventory = await tx.inventory.create({
        data: {
          tenant_id: productData.tenant_id,
          variant_id: variant.id,
          quantity: quantity,
        },
      });

      return {
        productMaster,
        product,
        variant,
        barcode,
        inventory,
      };
    });
  }
}
