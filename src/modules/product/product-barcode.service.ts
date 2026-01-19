import { ProductBarcodeRepository } from './product-barcode.repository';
import { CategoryRepository } from '../category/category.repository';
import { CreateProductFromBarcodeInput } from './product-barcode.validation';
import { NotFoundError, ConflictError } from '@utils/errors';
import axios from 'axios';
import { prisma } from '@config/database';
import { logger } from '@utils/logger';

/**
 * External product data from Open Food Facts
 */
interface ExternalProductData {
  name: string | null;
  brand: string | null;
  image_url: string | null;
  quantity: string | null;
  category_hint: string | null;
}

/**
 * Response for barcode lookup (local + external)
 */
export interface BarcodeLookupResponse {
  source: 'LOCAL' | 'EXTERNAL' | 'NONE';
  found: boolean;
  data?: {
    name: string | null;
    brand: string | null;
    image_url: string | null;
    quantity: string | null;
    category_hint: string | null;
    barcode: string;
    // Local data fields
    product_master_id?: number;
    category_id?: number;
    mrp?: number;
    selling_price?: number;
  };
}

/**
 * Response for barcode scan
 */
export interface BarcodeScanResponse {
  found: boolean;
  data?: {
    barcode: {
      id: string;
      barcode: string;
      is_active: boolean;
    };
    product: {
      id: string;
      name: string | null;
      category_id: string | null;
      category?: {
        id: string;
        name: string | null;
        is_active: boolean;
      } | null;
      is_active: boolean;
    };
    variant: {
      id: string;
      product_id: string;
      sku: string | null;
      mrp_price: number;
      selling_price: number;
      price: number;
      size: string | null;
      is_active: boolean | null;
    };
    inventory: {
      variant_id: string;
      quantity: number | null;
      low_stock_threshold: number | null;
    } | null;
  };
}

/**
 * Response for product creation via barcode
 */
export interface CreateProductBarcodeResponse {
  barcode: {
    id: string;
    barcode: string;
    is_active: boolean;
  };
  product: {
    id: string;
    name: string | null;
    category_id: string | null;
    is_active: boolean;
  };
  variant: {
    id: string;
    product_id: string;
    sku: string | null;
    mrp_price: number;
    selling_price: number;
    price: number;
    size: string | null;
    is_active: boolean | null;
  };
  inventory: {
    variant_id: string;
    quantity: number | null;
    low_stock_threshold: number | null;
  };
}

/**
 * Service for barcode-based product operations
 */
export class ProductBarcodeService {
  private readonly repository: ProductBarcodeRepository;
  private readonly categoryRepository: CategoryRepository;

  constructor() {
    this.repository = new ProductBarcodeRepository();
    this.categoryRepository = new CategoryRepository();
  }

  /**
   * Check if product exists in local database
   */
  private async checkLocalProduct(
    tenantId: number,
    barcode: string
  ): Promise<BarcodeLookupResponse | null> {
    try {
      const existingBarcode = await prisma.product_barcodes.findFirst({
        where: {
          barcode: barcode,
          tenant_id: tenantId,
          is_active: true,
        },
        include: {
          product_variants: {
            include: {
              products: {
                include: {
                  categories: true,
                  product_master: true,
                },
              },
            },
          },
        },
      });

      if (!existingBarcode || !existingBarcode.product_variants) {
        return null;
      }

      const variant = existingBarcode.product_variants;
      const product = variant.products;
      const master = product?.product_master;

      return {
        source: 'LOCAL',
        found: true,
        data: {
          barcode,
          name: master?.name || product?.name || null,
          brand: variant.brand || master?.brand || null,
          image_url: variant.image_url || product?.image_url || master?.default_image_url || null,
          quantity: variant.size || null,
          category_hint: product?.categories?.name || master?.category_name || null,
          product_master_id: master?.id ? Number(master.id) : undefined,
          category_id: product?.category_id ? Number(product.category_id) : undefined,
          mrp: variant.mrp_price ? parseFloat(variant.mrp_price.toString()) : undefined,
          selling_price: variant.selling_price ? parseFloat(variant.selling_price.toString()) : undefined,
        },
      };
    } catch (error) {
      logger.error('Error checking local product:', error);
      return null;
    }
  }

  /**
   * Lookup product from Open Food Facts API
   */
  private async lookupExternalProduct(barcode: string): Promise<ExternalProductData | null> {
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
      
      logger.info(`Looking up barcode ${barcode} from Open Food Facts`);
      
      const response = await axios.get(url, {
        timeout: 3000, // 3 second timeout
        headers: {
          'User-Agent': 'Kirana-POS/1.0',
        },
      });

      // Check if product was found
      if (response.data?.status !== 1 || !response.data?.product) {
        logger.warn(`Barcode ${barcode} not found in Open Food Facts`);
        return null;
      }

      const product = response.data.product;

      // Map fields safely (null-safe)
      const mappedData: ExternalProductData = {
        name: product.product_name || null,
        brand: product.brands || null,
        image_url: product.image_front_url || product.image_url || null,
        quantity: product.quantity || null,
        category_hint: Array.isArray(product.categories_tags) && product.categories_tags.length > 0
          ? product.categories_tags[0]
          : null,
      };

      logger.info(`External product found for barcode ${barcode}: ${mappedData.name}`);
      
      return mappedData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          logger.warn(`External API timeout for barcode ${barcode}`);
        } else if (error.response?.status === 404) {
          logger.warn(`Barcode ${barcode} not found in Open Food Facts (404)`);
        } else {
          logger.warn(`External API error for barcode ${barcode}:`, error.message);
        }
      } else {
        logger.warn(`Unexpected error during external lookup for barcode ${barcode}:`, error);
      }
      return null;
    }
  }

  /**
   * Lookup product by barcode (local first, then external)
   */
  async lookupBarcode(tenantId: number, barcode: string): Promise<BarcodeLookupResponse> {
    // Step 1: Check local database
    const localResult = await this.checkLocalProduct(tenantId, barcode);
    if (localResult) {
      return localResult;
    }

    // Step 2: Check external API (Open Food Facts)
    const externalData = await this.lookupExternalProduct(barcode);
    if (externalData) {
      return {
        source: 'EXTERNAL',
        found: true,
        data: {
          barcode,
          ...externalData,
        },
      };
    }

    // Step 3: Nothing found
    return {
      source: 'NONE',
      found: false,
    };
  }

  /**
   * Scan barcode and return product details if exists (local only)
   */
  async scanBarcode(tenantId: string, barcode: string): Promise<BarcodeScanResponse> {
    const tenantIdBigInt = BigInt(tenantId);
    
    const result = await this.repository.findBarcodeByTenantAndValue(tenantIdBigInt, barcode);

    if (!result) {
      return { found: false };
    }

    // Format response
    return {
      found: true,
      data: {
        barcode: {
          id: result.id.toString(),
          barcode: result.barcode,
          is_active: result.is_active || false,
        },
        product: {
          id: result.product_variants.products.id.toString(),
          name: result.product_variants.products.name,
          category_id: result.product_variants.products.category_id?.toString() || null,
          category: result.product_variants.products.categories
            ? {
                id: result.product_variants.products.categories.id.toString(),
                name: result.product_variants.products.categories.name,
                is_active: result.product_variants.products.categories.is_active,
              }
            : null,
          is_active: result.product_variants.products.is_active,
        },
        variant: {
          id: result.product_variants.id.toString(),
          product_id: result.product_variants.product_id.toString(),
          sku: result.product_variants.sku,
          mrp_price: Number(result.product_variants.mrp_price) || 0,
          selling_price: Number(result.product_variants.selling_price) || 0,
          price: Number(result.product_variants.price) || 0,
          size: result.product_variants.size,
          is_active: result.product_variants.is_active,
        },
        inventory: result.product_variants.inventory
          ? {
              variant_id: result.product_variants.inventory.variant_id.toString(),
              quantity: result.product_variants.inventory.quantity,
              low_stock_threshold: result.product_variants.inventory.low_stock_threshold,
            }
          : null,
      },
    };
  }

  /**
   * Create product using barcode in a single transaction
   */
  async createProductFromBarcode(
    tenantId: string,
    data: CreateProductFromBarcodeInput
  ): Promise<CreateProductBarcodeResponse> {
    const tenantIdBigInt = BigInt(tenantId);

    // Check if barcode already exists for this tenant
    const existingBarcode = await this.repository.findBarcodeByTenantAndValue(
      tenantIdBigInt,
      data.barcode
    );

    // If barcode exists, return the existing product (not an error)
    if (existingBarcode) {
      return {
        barcode: {
          id: existingBarcode.id.toString(),
          barcode: existingBarcode.barcode,
          is_active: existingBarcode.is_active || false,
        },
        product: {
          id: existingBarcode.product_variants.products.id.toString(),
          name: existingBarcode.product_variants.products.name,
          category_id: existingBarcode.product_variants.products.category_id?.toString() || null,
          is_active: existingBarcode.product_variants.products.is_active,
        },
        variant: {
          id: existingBarcode.product_variants.id.toString(),
          product_id: existingBarcode.product_variants.product_id.toString(),
          sku: existingBarcode.product_variants.sku,
          mrp_price: Number(existingBarcode.product_variants.mrp_price) || 0,
          selling_price: Number(existingBarcode.product_variants.selling_price) || 0,
          price: Number(existingBarcode.product_variants.price) || 0,
          size: existingBarcode.product_variants.size,
          is_active: existingBarcode.product_variants.is_active,
        },
        inventory: {
          variant_id: existingBarcode.product_variants.inventory!.variant_id.toString(),
          quantity: existingBarcode.product_variants.inventory!.quantity,
          low_stock_threshold: existingBarcode.product_variants.inventory!.low_stock_threshold,
        },
      };
    }

    // Validate category if provided
    let categoryIdBigInt: bigint | null = null;
    if (data.product.categoryId) {
      const category = await this.categoryRepository.findByIdAndTenant(
        BigInt(data.product.categoryId),
        tenantIdBigInt
      );
      if (!category) {
        throw new NotFoundError('Category not found or does not belong to your tenant');
      }
      if (!category.is_active) {
        throw new ConflictError('Cannot assign inactive category to product');
      }
      categoryIdBigInt = BigInt(data.product.categoryId);
    }

    // Check if product master already exists
    const existingProductMaster = await this.repository.findProductMasterByNameAndBrand(
      data.productMaster.name,
      data.productMaster.brand
    );

    // Build size string from unit and unitValue
    let sizeString: string | null = null;
    if (data.variant.unit && data.variant.unitValue) {
      sizeString = `${data.variant.unitValue}${data.variant.unit}`;
    }

    // Create product with barcode in transaction
    const result = await this.repository.createProductWithBarcode(
      {
        name: data.productMaster.name,
        brand: data.productMaster.brand,
        category_name: data.productMaster.categoryName,
      },
      {
        tenant_id: tenantIdBigInt,
        name: data.product.name,
        category_id: categoryIdBigInt,
      },
      {
        tenant_id: tenantIdBigInt,
        sku: data.variant.sku,
        mrp_price: data.variant.mrp,
        selling_price: data.variant.sellingPrice,
        size: sizeString,
      },
      data.barcode,
      data.inventory.quantity,
      existingProductMaster || undefined
    );

    // Format and return response
    return {
      barcode: {
        id: result.barcode.id.toString(),
        barcode: result.barcode.barcode,
        is_active: result.barcode.is_active || false,
      },
      product: {
        id: result.product.id.toString(),
        name: result.product.name,
        category_id: result.product.category_id?.toString() || null,
        is_active: result.product.is_active,
      },
      variant: {
        id: result.variant.id.toString(),
        product_id: result.variant.product_id.toString(),
        sku: result.variant.sku,
        mrp_price: Number(result.variant.mrp_price) || 0,
        selling_price: Number(result.variant.selling_price) || 0,
        price: Number(result.variant.price) || 0,
        size: result.variant.size,
        is_active: result.variant.is_active,
      },
      inventory: {
        variant_id: result.inventory.variant_id.toString(),
        quantity: result.inventory.quantity,
        low_stock_threshold: result.inventory.low_stock_threshold,
      },
    };
  }
}
