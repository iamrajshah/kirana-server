import { Product, product_variants } from '@prisma/client';
import { ProductRepository, VariantRepository } from './product.repository';
import { CategoryRepository } from '../category/category.repository';
import { ReportsRepository } from '../reports/reports.repository';
import {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
} from './product.validation';
import { ConflictError, NotFoundError } from '@utils/errors';
import { AuditLogger } from '@utils/auditLogger';

export interface ProductResponse {
  id: string;
  name: string | null;
  category_id: string | null;
  is_active: boolean;
  variants: VariantResponse[];
}

export interface VariantResponse {
  id: string;
  brand: string | null;
  size: string | null;
  packaging: string | null;
  price: number;
  gst_percent: number | null;
  sku: string | null;
  is_active: boolean | null;
}

export class ProductService {
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: VariantRepository;
  private readonly categoryRepository: CategoryRepository;
  private readonly reportsRepository: ReportsRepository;

  constructor() {
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
    this.categoryRepository = new CategoryRepository();
    this.reportsRepository = new ReportsRepository();
  }

  /**
   * Create a new product
   */
  async createProduct(
    tenantId: string,
    data: CreateProductInput,
    _createdBy: string
  ): Promise<ProductResponse> {
    const tenantIdBigInt = BigInt(tenantId);

    // Check if product with same name already exists (case-insensitive)
    const existingProduct = await this.productRepository.findByName(data.name, tenantId);
    if (existingProduct) {
      throw new ConflictError('Product with this name already exists');
    }

    // Validate category if provided
    if (data.category_id) {
      const category = await this.categoryRepository.findByIdAndTenant(
        BigInt(data.category_id),
        tenantIdBigInt
      );
      if (!category) {
        throw new NotFoundError('Category not found or does not belong to your tenant');
      }
      if (!category.is_active) {
        throw new ConflictError('Cannot assign inactive category to product');
      }
    }

    const product = await this.productRepository.createProduct({
      tenant_id: tenantIdBigInt,
      name: data.name,
      category_id: data.category_id ? BigInt(data.category_id) : null,
    });

    // Audit log
    AuditLogger.create(
      tenantIdBigInt,
      BigInt(_createdBy),
      'product',
      product.id,
      { name: product.name, category_id: product.category_id?.toString(), is_active: product.is_active }
    );

    return this.formatProductResponse(product);
  }

  /**
   * Get all products with pagination
   */
  async getAllProducts(
    tenantId: string,
    page: number = 1,
    limit: number = 50,
    searchQuery?: string,
    includeInactive: boolean = false
  ): Promise<{ products: ProductResponse[]; total: number; page: number; limit: number }> {
    const tenantIdBigInt = BigInt(tenantId);
    const skip = (page - 1) * limit;

    const { products, total } = await this.productRepository.findAllByTenant(tenantIdBigInt, {
      skip,
      take: limit,
      searchQuery,
      includeInactive,
    });

    return {
      products: products.map((p) => this.formatProductResponse(p)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string, tenantId: string): Promise<ProductResponse> {
    const productIdBigInt = BigInt(productId);
    const tenantIdBigInt = BigInt(tenantId);

    const product = await this.productRepository.findByIdAndTenant(productIdBigInt, tenantIdBigInt);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return this.formatProductResponse(product);
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    tenantId: string,
    data: UpdateProductInput,
    userId?: string
  ): Promise<ProductResponse> {
    const productIdBigInt = BigInt(productId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if product exists
    const existingProduct = await this.productRepository.findByIdAndTenant(
      productIdBigInt,
      tenantIdBigInt
    );
    if (!existingProduct) {
      throw new NotFoundError('Product not found');
    }

    // If name is being updated, check for duplicates
    if (data.name && data.name !== existingProduct.name) {
      const nameExists = await this.productRepository.findByName(data.name, tenantId);
      if (nameExists && nameExists.id.toString() !== productId) {
        throw new ConflictError('Product with this name already exists');
      }
    }

    // Validate category if provided
    if (data.category_id !== undefined && data.category_id !== null) {
      const category = await this.categoryRepository.findByIdAndTenant(
        BigInt(data.category_id),
        tenantIdBigInt
      );
      if (!category) {
        throw new NotFoundError('Category not found or does not belong to your tenant');
      }
      if (!category.is_active) {
        throw new ConflictError('Cannot assign inactive category to product');
      }
    }

    const updatedProduct = await this.productRepository.updateProduct(
      productIdBigInt,
      tenantIdBigInt,
      {
        name: data.name,
        category_id: data.category_id !== undefined ? (data.category_id ? BigInt(data.category_id) : null) : undefined,
      }
    );

    // Audit log (only if userId is available)
    if (userId) {
      AuditLogger.update(
        tenantIdBigInt,
        BigInt(userId),
        'product',
        productIdBigInt,
        { name: existingProduct.name, category_id: existingProduct.category_id?.toString() },
        { name: updatedProduct.name, category_id: updatedProduct.category_id?.toString() }
      );
    }

    return this.formatProductResponse(updatedProduct);
  }

  /**
   * Update product status
   */
  async updateProductStatus(
    productId: string,
    tenantId: string,
    is_active: boolean,
    userId?: string
  ): Promise<ProductResponse> {
    const productIdBigInt = BigInt(productId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if product exists
    const existingProduct = await this.productRepository.findByIdAndTenant(
      productIdBigInt,
      tenantIdBigInt
    );
    if (!existingProduct) {
      throw new NotFoundError('Product not found');
    }

    // If deactivating the product, check if any variant is referenced in invoices
    if (!is_active && existingProduct.is_active) {
      // Get all variants for this product
      const variants = await this.variantRepository.findByProduct(productIdBigInt);
      
      // Check each variant for invoice references
      for (const variant of variants) {
        const isReferenced = await this.reportsRepository.isVariantReferencedByInvoices(
          variant.id,
          tenantIdBigInt
        );
        
        if (isReferenced) {
          throw new ConflictError(
            `Cannot deactivate product. Variant "${variant.brand} ${variant.size} ${variant.packaging}" (SKU: ${variant.sku}) is referenced in invoices. Consider keeping it active or creating a new variant.`
          );
        }
      }
    }

    const updatedProduct = await this.productRepository.updateStatus(
      productIdBigInt,
      tenantIdBigInt,
      is_active
    );

    // Audit log (only if userId is available)
    if (userId) {
      AuditLogger.statusChange(
        tenantIdBigInt,
        BigInt(userId),
        'product',
        productIdBigInt,
        { is_active: existingProduct.is_active, name: existingProduct.name },
        { is_active: updatedProduct.is_active, name: updatedProduct.name }
      );
    }

    return this.formatProductResponse(updatedProduct);
  }

  /**
   * Create a variant for a product
   */
  async createVariant(
    productId: string,
    tenantId: string,
    data: CreateVariantInput,
    _createdBy: string
  ): Promise<VariantResponse> {
    const productIdBigInt = BigInt(productId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if product exists
    const product = await this.productRepository.findByIdAndTenant(productIdBigInt, tenantIdBigInt);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    if (!product.is_active) {
      throw new ConflictError('Cannot create variant for inactive product');
    }

    // Check if variant with same composite key (brand+size+packaging) exists
    const existingVariant = await this.variantRepository.findByComposite(
      productIdBigInt,
      data.brand,
      data.size,
      data.packaging
    );
    if (existingVariant) {
      throw new ConflictError('Variant with this combination already exists for this product');
    }

    // If SKU provided, check uniqueness within tenant
    if (data.sku) {
      const skuExists = await this.variantRepository.findBySKU(data.sku, tenantId);
      if (skuExists) {
        throw new ConflictError('SKU already exists');
      }
    }

    const variant = await this.variantRepository.createVariant({
      tenant_id: tenantIdBigInt,
      product_id: productIdBigInt,
      brand: data.brand,
      size: data.size,
      packaging: data.packaging,
      price: data.price,
      gst_percent: data.gst_percent,
      sku: data.sku,
    });

    // Audit log
    AuditLogger.create(
      tenantIdBigInt,
      BigInt(_createdBy),
      'variant',
      variant.id,
      { brand: variant.brand, size: variant.size, packaging: variant.packaging, price: Number(variant.price), sku: variant.sku }
    );

    return this.formatVariantResponse(variant);
  }

  /**
   * Update a variant
   */
  async updateVariant(
    variantId: string,
    tenantId: string,
    data: UpdateVariantInput,
    userId?: string
  ): Promise<VariantResponse> {
    const variantIdBigInt = BigInt(variantId);
    const tenantIdBigInt = BigInt(tenantId);

    // Check if variant exists
    const existingVariant = await this.variantRepository.findByIdAndTenant(
      variantIdBigInt,
      tenantIdBigInt
    );
    if (!existingVariant) {
      throw new NotFoundError('Variant not found');
    }

    // If deactivating the variant, check if it's referenced in invoices
    if (data.is_active === false && existingVariant.is_active) {
      const isReferenced = await this.reportsRepository.isVariantReferencedByInvoices(
        variantIdBigInt,
        tenantIdBigInt
      );
      
      if (isReferenced) {
        throw new ConflictError(
          `Cannot deactivate variant "${existingVariant.brand} ${existingVariant.size} ${existingVariant.packaging}" (SKU: ${existingVariant.sku}). It is referenced in existing invoices. Consider creating a new variant instead.`
        );
      }
    }

    // If SKU is being updated, check uniqueness
    if (data.sku && data.sku !== existingVariant.sku) {
      const skuExists = await this.variantRepository.findBySKU(data.sku, tenantId);
      if (skuExists && skuExists.id.toString() !== variantId) {
        throw new ConflictError('SKU already exists');
      }
    }

    const updatedVariant = await this.variantRepository.updateVariant(
      variantIdBigInt,
      tenantIdBigInt,
      data
    );

    // Audit log (only if userId is available)
    if (userId) {
      const isStatusChange = data.is_active !== undefined;
      const oldValue = {
        brand: existingVariant.brand,
        size: existingVariant.size,
        packaging: existingVariant.packaging,
        price: Number(existingVariant.price),
        sku: existingVariant.sku,
        is_active: existingVariant.is_active
      };
      const newValue = {
        brand: updatedVariant.brand,
        size: updatedVariant.size,
        packaging: updatedVariant.packaging,
        price: Number(updatedVariant.price),
        sku: updatedVariant.sku,
        is_active: updatedVariant.is_active
      };
      
      if (isStatusChange) {
        AuditLogger.statusChange(
          tenantIdBigInt,
          BigInt(userId),
          'variant',
          variantIdBigInt,
          oldValue,
          newValue
        );
      } else {
        AuditLogger.update(
          tenantIdBigInt,
          BigInt(userId),
          'variant',
          variantIdBigInt,
          oldValue,
          newValue
        );
      }
    }

    return this.formatVariantResponse(updatedVariant);
  }

  /**
   * Format product response
   */
  private formatProductResponse(
    product: Product & { product_variants?: product_variants[] }
  ): ProductResponse {
    return {
      id: product.id.toString(),
      name: product.name,
      category_id: product.category_id?.toString() || null,
      is_active: product.is_active,
      variants: (product.product_variants || []).map((v) => this.formatVariantResponse(v)),
    };
  }

  /**
   * Format variant response
   */
  private formatVariantResponse(variant: product_variants): VariantResponse {
    return {
      id: variant.id.toString(),
      brand: variant.brand,
      size: variant.size,
      packaging: variant.packaging,
      price: Number(variant.price),
      gst_percent: variant.gst_percent ? Number(variant.gst_percent) : null,
      sku: variant.sku,
      is_active: variant.is_active,
    };
  }
}
