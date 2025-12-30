import { prisma } from '@config/database';
import { Prisma } from '@prisma/client';

export class ReportsRepository {
  /**
   * Get sales summary for a date range
   */
  async getSalesSummary(
    tenant_id: bigint,
    from?: Date,
    to?: Date
  ): Promise<{
    totalSales: number;
    totalInvoices: number;
    totalGst: number;
    paidInvoices: number;
    unpaidInvoices: number;
  }> {
    const where: any = {
      tenant_id,
    };

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = from;
      if (to) where.created_at.lte = to;
    }

    const [invoices, aggregates] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          total_amount: true,
          gst_amount: true,
          status: true,
        },
      }),
      prisma.invoice.aggregate({
        where,
        _count: true,
      }),
    ]);

    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const totalGst = invoices.reduce((sum, inv) => sum + Number(inv.gst_amount || 0), 0);
    const paidInvoices = invoices.filter((inv) => inv.status === 'PAID').length;
    const unpaidInvoices = invoices.filter((inv) => inv.status === 'UNPAID').length;

    return {
      totalSales,
      totalInvoices: aggregates._count,
      totalGst,
      paidInvoices,
      unpaidInvoices,
    };
  }

  /**
   * Get daily sales breakdown
   */
  async getDailySales(tenant_id: bigint, from?: Date, to?: Date): Promise<any[]> {
    const where: any = {
      tenant_id,
    };

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = from;
      if (to) where.created_at.lte = to;
    }

    return prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as invoice_count,
        SUM(total_amount) as total_sales,
        SUM(gst_amount) as total_gst,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'UNPAID' THEN 1 ELSE 0 END) as unpaid_count
      FROM invoices
      WHERE tenant_id = ${tenant_id}
        ${from ? Prisma.sql`AND created_at >= ${from}` : Prisma.sql``}
        ${to ? Prisma.sql`AND created_at <= ${to}` : Prisma.sql``}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
  }

  /**
   * Get customers with outstanding balances
   */
  async getOutstandingCustomers(tenant_id: bigint): Promise<any[]> {
    return prisma.customer.findMany({
      where: {
        tenant_id,
        credit_balance: {
          gt: 0,
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        credit_balance: true,
      },
      orderBy: {
        credit_balance: 'desc',
      },
    });
  }

  /**
   * Get inventory summary
   */
  async getInventorySummary(tenant_id: bigint): Promise<{
    totalItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
  }> {
    const inventory = await prisma.inventory.findMany({
      where: {
        tenant_id,
      },
      include: {
        product_variants: {
          select: {
            price: true,
          },
        },
      },
    });

    const totalItems = inventory.length;
    const lowStockItems = inventory.filter(
      (item) => (item.quantity ?? 0) <= (item.low_stock_threshold ?? 5)
    ).length;
    const outOfStockItems = inventory.filter((item) => (item.quantity ?? 0) === 0).length;
    const totalValue = inventory.reduce(
      (sum, item) =>
        sum + (item.quantity ?? 0) * Number(item.product_variants?.price || 0),
      0
    );

    return {
      totalItems,
      lowStockItems,
      outOfStockItems,
      totalValue,
    };
  }

  /**
   * Get detailed inventory stock list
   */
  async getInventoryStockList(tenant_id: bigint): Promise<any[]> {
    return prisma.inventory.findMany({
      where: {
        tenant_id,
      },
      include: {
        product_variants: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                is_active: true,
              },
            },
          },
        },
      },
      orderBy: {
        variant_id: 'desc',
      },
    });
  }

  /**
   * Get daily cashbook - payment collections by mode
   */
  async getDailyCashbook(tenant_id: bigint, date?: Date): Promise<any[]> {
    const startDate = date ? new Date(date.setHours(0, 0, 0, 0)) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    return prisma.$queryRaw`
      SELECT 
        payment_mode,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM payments
      WHERE tenant_id = ${tenant_id}
        AND created_at >= ${startDate}
        AND created_at < ${endDate}
      GROUP BY payment_mode
      ORDER BY total_amount DESC
    `;
  }

  /**
   * Get profit & loss summary
   */
  async getProfitLoss(
    tenant_id: bigint,
    from?: Date,
    to?: Date
  ): Promise<{
    revenue: number;
    gstCollected: number;
    netRevenue: number;
    totalPayments: number;
    outstandingAmount: number;
  }> {
    const invoiceWhere: any = { tenant_id };
    const paymentWhere: any = { tenant_id };

    if (from || to) {
      invoiceWhere.created_at = {};
      paymentWhere.created_at = {};
      if (from) {
        invoiceWhere.created_at.gte = from;
        paymentWhere.created_at.gte = from;
      }
      if (to) {
        invoiceWhere.created_at.lte = to;
        paymentWhere.created_at.lte = to;
      }
    }

    const [invoices, payments, customers] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          total_amount: true,
          gst_amount: true,
        },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        select: {
          amount: true,
        },
      }),
      prisma.customer.findMany({
        where: {
          tenant_id,
          credit_balance: {
            gt: 0,
          },
        },
        select: {
          credit_balance: true,
        },
      }),
    ]);

    const revenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const gstCollected = invoices.reduce((sum, inv) => sum + Number(inv.gst_amount || 0), 0);
    const totalPayments = payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
    const outstandingAmount = customers.reduce((sum, cust) => sum + Number(cust.credit_balance || 0), 0);

    return {
      revenue,
      gstCollected,
      netRevenue: revenue - gstCollected,
      totalPayments,
      outstandingAmount,
    };
  }

  /**
   * Get top selling products
   */
  async getTopSellingProducts(tenant_id: bigint, limit: number = 10): Promise<any[]> {
    return prisma.$queryRaw`
      SELECT 
        pv.id as variant_id,
        pv.sku,
        p.name as product_name,
        pv.brand,
        pv.size,
        SUM(ii.quantity) as total_sold,
        SUM(ii.quantity * ii.price) as total_revenue
      FROM invoice_items ii
      INNER JOIN product_variants pv ON ii.variant_id = pv.id
      INNER JOIN products p ON pv.product_id = p.id
      INNER JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.tenant_id = ${tenant_id}
      GROUP BY pv.id, pv.sku, p.name, pv.brand, pv.size
      ORDER BY total_sold DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Check if entity is referenced by invoices
   */
  async isVariantReferencedByInvoices(variant_id: bigint, tenant_id: bigint): Promise<boolean> {
    const count = await prisma.invoiceItem.count({
      where: {
        variant_id,
        invoices: {
          tenant_id,
        },
      },
    });
    return count > 0;
  }

  /**
   * Check if customer is referenced by invoices or payments
   */
  async isCustomerReferenced(customer_id: bigint, tenant_id: bigint): Promise<boolean> {
    const [invoiceCount, paymentCount] = await Promise.all([
      prisma.invoice.count({
        where: {
          customer_id,
          tenant_id,
        },
      }),
      prisma.payment.count({
        where: {
          customer_id,
          tenant_id,
        },
      }),
    ]);
    return invoiceCount > 0 || paymentCount > 0;
  }
}
