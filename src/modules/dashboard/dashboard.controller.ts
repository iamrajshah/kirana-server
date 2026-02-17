import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = new DashboardService();
  }

  /**
   * Get dashboard statistics
   */
  getStats = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = BigInt((req as any).tenantId);

    const stats = await this.dashboardService.getStats(tenantId);

    return res.status(200).json({
      success: true,
      data: stats,
      message: 'Dashboard stats retrieved successfully',
    });
  };
}
