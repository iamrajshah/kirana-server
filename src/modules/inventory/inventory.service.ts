import { InventoryRepository } from './inventory.repository';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { prisma } from '@config/database';

export class InventoryService {
  private inventoryRepository: InventoryRepository;

  constructor() {
    this.inventoryRepository = new InventoryRepository();
  }

  /**
   * Get all inventory for a tenant
   */
  async getAllInventory(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      searchQuery?: string;
    }
  ) {
    const { inventory, total } = await this.inventoryRepository.findAllByTenant(tenant_id, options);

    return {
      inventory: inventory.map((item) => ({
        variant_id: item.variant_id.toString(),
        quantity: item.quantity,
        low_stock_threshold: item.low_stock_threshold,
        is_low_stock: item.quantity <= item.low_stock_threshold,
        variant: item.product_variants
          ? {
              id: item.product_variants.id.toString(),
              sku: item.product_variants.sku,
              price: item.product_variants.price,
              is_active: item.product_variants.is_active,
              product: item.product_variants.products
                ? {
                    id: item.product_variants.products.id.toString(),
                    name: item.product_variants.products.name,
                    is_active: item.product_variants.products.is_active,
                  }
                : null,
            }
          : null,
      })),
      total,
    };
  }

  /**
   * Get low stock inventory
   */
  async getLowStockInventory(tenant_id: bigint) {
    const inventory = await this.inventoryRepository.findLowStock(tenant_id);

    return inventory.map((item: any) => ({
      variant_id: item.variant_id?.toString(),
      quantity: item.quantity,
      low_stock_threshold: item.low_stock_threshold,
      sku: item.sku,
      price: item.price,
      product_name: item.name,
    }));
  }

  /**
   * Get inventory by variant ID
   */
  async getInventoryByVariant(variant_id: bigint, tenant_id: bigint) {
    const inventory = await this.inventoryRepository.findByVariantIdAndTenant(variant_id, tenant_id);

    if (!inventory) {
      throw new NotFoundError('Inventory not found for this variant');
    }

    return {
      variant_id: inventory.variant_id.toString(),
      quantity: inventory.quantity ?? 0,
      low_stock_threshold: inventory.low_stock_threshold ?? 5,
      is_low_stock: (inventory.quantity ?? 0) <= (inventory.low_stock_threshold ?? 5),
    };
  }

  /**
   * Update inventory quantity
   * Only OWNER and MANAGER can update inventory
   */
  async updateInventory(
    variant_id: bigint,
    tenant_id: bigint,
    quantity: number,
    low_stock_threshold?: number
  ) {
    // Validate variant exists and belongs to tenant
    const variant = await prisma.product_variants.findFirst({
      where: {
        id: variant_id,
        products: {
          tenant_id,
        },
      },
    });

    if (!variant) {
      throw new NotFoundError('Variant not found');
    }

    if (quantity < 0) {
      throw new BadRequestError('Quantity cannot be negative');
    }

    // Check if inventory exists
    const existingInventory = await this.inventoryRepository.findByVariantIdAndTenant(variant_id, tenant_id);

    let inventory;
    if (existingInventory) {
      inventory = await this.inventoryRepository.updateQuantity(
        variant_id,
        tenant_id,
        quantity,
        low_stock_threshold
      );
    } else {
      // Create inventory if doesn't exist
      inventory = await this.inventoryRepository.upsertInventory(
        variant_id,
        tenant_id,
        quantity,
        low_stock_threshold || 5
      );
    }

    return {
      variant_id: inventory.variant_id.toString(),
      quantity: inventory.quantity ?? 0,
      low_stock_threshold: inventory.low_stock_threshold ?? 5,
      is_low_stock: (inventory.quantity ?? 0) <= (inventory.low_stock_threshold ?? 5),
    };
  }

  /**
   * Adjust inventory (increment/decrement)
   * Only OWNER and MANAGER can adjust inventory
   */
  async adjustInventory(variant_id: bigint, tenant_id: bigint, adjustment: number, reason?: string) {
    // Validate variant exists and belongs to tenant
    const variant = await prisma.product_variants.findFirst({
      where: {
        id: variant_id,
        products: {
          tenant_id,
        },
      },
    });

    if (!variant) {
      throw new NotFoundError('Variant not found');
    }

    const existingInventory = await this.inventoryRepository.findByVariantIdAndTenant(variant_id, tenant_id);

    if (!existingInventory) {
      throw new NotFoundError('Inventory not found for this variant');
    }

    const currentQuantity = existingInventory.quantity ?? 0;
    const newQuantity = currentQuantity + adjustment;

    if (newQuantity < 0) {
      throw new BadRequestError(
        `Cannot adjust inventory. Current quantity: ${existingInventory.quantity}, Adjustment: ${adjustment}`
      );
    }

    const inventory = await this.inventoryRepository.updateQuantity(variant_id, tenant_id, newQuantity);

    return {
      variant_id: inventory.variant_id.toString(),
      quantity: inventory.quantity ?? 0,
      low_stock_threshold: inventory.low_stock_threshold ?? 5,
      is_low_stock: (inventory.quantity ?? 0) <= (inventory.low_stock_threshold ?? 5),
      adjustment,
      reason,
    };
  }
}
