import { Product, product_variants } from '@prisma/client';
import { ProductRepository, VariantRepository } from './product.repository';
import { CategoryRepository } from '../category/category.repository';
import {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
} from './product.validation';
import { ConflictError, NotFoundError } from '@utils/errors';

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

  constructor() {
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
    this.categoryRepository = new CategoryRepository();
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
    data: UpdateProductInput
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

    return this.formatProductResponse(updatedProduct);
  }

  /**
   * Update product status
   */
  async updateProductStatus(
    productId: string,
    tenantId: string,
    is_active: boolean
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

    const updatedProduct = await this.productRepository.updateStatus(
      productIdBigInt,
      tenantIdBigInt,
      is_active
    );

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

    return this.formatVariantResponse(variant);
  }

  /**
   * Update a variant
   */
  async updateVariant(
    variantId: string,
    tenantId: string,
    data: UpdateVariantInput
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
