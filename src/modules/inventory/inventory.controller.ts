import { Request, Response } from 'express';
import { InventoryService } from './inventory.service';
import { TenantRequest } from '@middlewares/tenant.middleware';
import { AuthRequest } from '@middlewares/auth.middleware';

export class InventoryController {
  private inventoryService: InventoryService;

  constructor() {
    this.inventoryService = new InventoryService();
  }

  getAllInventory = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);
    const skip = req.query.skip ? parseInt(req.query.skip as string) : undefined;
    const take = req.query.take ? parseInt(req.query.take as string) : undefined;
    const searchQuery = req.query.search as string | undefined;

    const result = await this.inventoryService.getAllInventory(tenant_id, {
      skip,
      take,
      searchQuery,
    });

    res.json({
      success: true,
      data: result.inventory,
      pagination: {
        total: result.total,
        skip: skip || 0,
        take: take || result.total,
      },
    });
  };

  getLowStockInventory = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const tenant_id = BigInt(tenantId);

    const inventory = await this.inventoryService.getLowStockInventory(tenant_id);

    res.json({
      success: true,
      data: inventory,
    });
  };

  getInventoryByVariant = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const variant_id = BigInt(req.params.variantId);
    const tenant_id = BigInt(tenantId);

    const inventory = await this.inventoryService.getInventoryByVariant(variant_id, tenant_id);

    res.json({
      success: true,
      data: inventory,
    });
  };

  updateInventory = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const variant_id = BigInt(req.params.variantId);
    const tenant_id = BigInt(tenantId);
    const { quantity, low_stock_threshold } = req.body;

    const inventory = await this.inventoryService.updateInventory(
      variant_id,
      tenant_id,
      quantity,
      low_stock_threshold,
      user?.userId
    );

    res.json({
      success: true,
      message: 'Inventory updated successfully',
      data: inventory,
    });
  };

  adjustInventory = async (req: Request, res: Response) => {
    const { tenantId } = req as TenantRequest;
    const { user } = req as AuthRequest;
    const variant_id = BigInt(req.params.variantId);
    const tenant_id = BigInt(tenantId);
    const { adjustment, reason } = req.body;

    const inventory = await this.inventoryService.adjustInventory(
      variant_id,
      tenant_id,
      adjustment,
      reason,
      user?.userId
    );

    res.json({
      success: true,
      message: 'Inventory adjusted successfully',
      data: inventory,
    });
  };
}
