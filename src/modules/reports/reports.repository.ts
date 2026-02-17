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
      (sum, item) => sum + (item.quantity ?? 0) * Number(item.product_variants?.price || 0),
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
    const startDate = date
      ? new Date(date.setHours(0, 0, 0, 0))
      : new Date(new Date().setHours(0, 0, 0, 0));
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
    const outstandingAmount = customers.reduce(
      (sum, cust) => sum + Number(cust.credit_balance || 0),
      0
    );

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

  /**
   * SUPPLIER & PURCHASE REPORTS
   */

  /**
   * Get supplier outstanding balances
   * Shows suppliers we owe money to with their outstanding amounts
   */
  async getSupplierOutstanding(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      minAmount?: number;
    }
  ): Promise<{ data: any[]; total: number }> {
    const minAmount = options?.minAmount || 0;

    const data = await prisma.$queryRaw<any[]>`
      SELECT 
        s.id,
        s.name,
        s.phone,
        s.email,
        COALESCE(SUM(sl.credit), 0) - COALESCE(SUM(sl.debit), 0) as outstanding_balance,
        COUNT(DISTINCT pi.id) as total_invoices,
        MAX(sl.created_at) as last_transaction_date
      FROM suppliers s
      LEFT JOIN supplier_ledger sl ON s.id = sl.supplier_id
      LEFT JOIN purchase_invoices pi ON s.id = pi.supplier_id AND pi.status != 'PAID'
      WHERE s.tenant_id = ${tenant_id}
        AND s.is_active = 1
      GROUP BY s.id, s.name, s.phone, s.email
      HAVING outstanding_balance > ${minAmount}
      ORDER BY outstanding_balance DESC
      ${options?.take ? Prisma.sql`LIMIT ${options.take}` : Prisma.sql``}
      ${options?.skip ? Prisma.sql`OFFSET ${options.skip}` : Prisma.sql``}
    `;

    const totalResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT s.id) as count
      FROM suppliers s
      LEFT JOIN supplier_ledger sl ON s.id = sl.supplier_id
      WHERE s.tenant_id = ${tenant_id}
        AND s.is_active = 1
      GROUP BY s.id
      HAVING COALESCE(SUM(sl.credit), 0) - COALESCE(SUM(sl.debit), 0) > ${minAmount}
    `;

    return {
      data,
      total: totalResult.length,
    };
  }

  /**
   * Get purchase register - all purchases with filters
   * SQL optimized with proper indexing
   */
  async getPurchaseRegister(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      from?: Date;
      to?: Date;
      supplierId?: bigint;
      status?: string;
    }
  ): Promise<{ data: any[]; total: number; summary: any }> {
    let dateFilter = Prisma.sql``;
    if (options?.from) {
      dateFilter = Prisma.sql`AND pi.invoice_date >= ${options.from}`;
    }
    if (options?.to) {
      dateFilter = Prisma.sql`${dateFilter} AND pi.invoice_date <= ${options.to}`;
    }

    let supplierFilter = Prisma.sql``;
    if (options?.supplierId) {
      supplierFilter = Prisma.sql`AND pi.supplier_id = ${options.supplierId}`;
    }

    let statusFilter = Prisma.sql``;
    if (options?.status) {
      statusFilter = Prisma.sql`AND pi.status = ${options.status}`;
    }

    const data = await prisma.$queryRaw<any[]>`
      SELECT 
        pi.id,
        pi.invoice_number,
        pi.invoice_date,
        pi.total_amount,
        pi.paid_amount,
        pi.status,
        s.name as supplier_name,
        s.phone as supplier_phone,
        COUNT(pii.id) as item_count,
        pi.created_at
      FROM purchase_invoices pi
      INNER JOIN suppliers s ON pi.supplier_id = s.id
      LEFT JOIN purchase_invoice_items pii ON pi.id = pii.purchase_invoice_id
      WHERE pi.tenant_id = ${tenant_id}
        ${dateFilter}
        ${supplierFilter}
        ${statusFilter}
      GROUP BY pi.id, pi.invoice_number, pi.invoice_date, pi.total_amount, 
               pi.paid_amount, pi.status, s.name, s.phone, pi.created_at
      ORDER BY pi.invoice_date DESC, pi.created_at DESC
      ${options?.take ? Prisma.sql`LIMIT ${options.take}` : Prisma.sql``}
      ${options?.skip ? Prisma.sql`OFFSET ${options.skip}` : Prisma.sql``}
    `;

    const countResult = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(DISTINCT pi.id) as total
      FROM purchase_invoices pi
      WHERE pi.tenant_id = ${tenant_id}
        ${dateFilter}
        ${supplierFilter}
        ${statusFilter}
    `;

    const summaryResult = await prisma.$queryRaw<[any]>`
      SELECT 
        COUNT(DISTINCT pi.id) as total_purchases,
        COALESCE(SUM(pi.total_amount), 0) as total_amount,
        COALESCE(SUM(pi.paid_amount), 0) as total_paid,
        COALESCE(SUM(pi.total_amount - pi.paid_amount), 0) as total_outstanding
      FROM purchase_invoices pi
      WHERE pi.tenant_id = ${tenant_id}
        ${dateFilter}
        ${supplierFilter}
        ${statusFilter}
    `;

    return {
      data,
      total: Number(countResult[0]?.total || 0),
      summary: summaryResult[0] || {},
    };
  }

  /**
   * Get supplier ledger summary
   * Groups ledger entries by supplier with aggregated data
   */
  async getSupplierLedgerSummary(
    tenant_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      from?: Date;
      to?: Date;
      supplierId?: bigint;
    }
  ): Promise<{ data: any[]; total: number }> {
    let dateFilter = Prisma.sql``;
    if (options?.from) {
      dateFilter = Prisma.sql`AND sl.created_at >= ${options.from}`;
    }
    if (options?.to) {
      dateFilter = Prisma.sql`${dateFilter} AND sl.created_at <= ${options.to}`;
    }

    let supplierFilter = Prisma.sql``;
    if (options?.supplierId) {
      supplierFilter = Prisma.sql`AND sl.supplier_id = ${options.supplierId}`;
    }

    const data = await prisma.$queryRaw<any[]>`
      SELECT 
        s.id as supplier_id,
        s.name as supplier_name,
        s.phone,
        s.email,
        COUNT(sl.id) as transaction_count,
        COALESCE(SUM(sl.credit), 0) as total_credit,
        COALESCE(SUM(sl.debit), 0) as total_debit,
        COALESCE(SUM(sl.credit), 0) - COALESCE(SUM(sl.debit), 0) as balance,
        MIN(sl.created_at) as first_transaction,
        MAX(sl.created_at) as last_transaction
      FROM suppliers s
      INNER JOIN supplier_ledger sl ON s.id = sl.supplier_id
      WHERE sl.tenant_id = ${tenant_id}
        ${dateFilter}
        ${supplierFilter}
      GROUP BY s.id, s.name, s.phone, s.email
      ORDER BY balance DESC
      ${options?.take ? Prisma.sql`LIMIT ${options.take}` : Prisma.sql``}
      ${options?.skip ? Prisma.sql`OFFSET ${options.skip}` : Prisma.sql``}
    `;

    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT s.id) as count
      FROM suppliers s
      INNER JOIN supplier_ledger sl ON s.id = sl.supplier_id
      WHERE sl.tenant_id = ${tenant_id}
        ${dateFilter}
        ${supplierFilter}
    `;

    return {
      data,
      total: Number(countResult[0]?.count || 0),
    };
  }

  /**
   * Get top payables - suppliers we owe the most
   * Optimized query with limit for performance
   */
  async getTopPayables(tenant_id: bigint, limit: number = 10): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT 
        s.id,
        s.name,
        s.phone,
        s.email,
        COALESCE(SUM(sl.credit), 0) - COALESCE(SUM(sl.debit), 0) as outstanding_amount,
        COUNT(DISTINCT pi.id) as unpaid_invoices,
        MAX(pi.invoice_date) as latest_invoice_date,
        MAX(sl.created_at) as last_transaction_date
      FROM suppliers s
      LEFT JOIN supplier_ledger sl ON s.id = sl.supplier_id
      LEFT JOIN purchase_invoices pi ON s.id = pi.supplier_id AND pi.status != 'PAID'
      WHERE s.tenant_id = ${tenant_id}
        AND s.is_active = 1
      GROUP BY s.id, s.name, s.phone, s.email
      HAVING outstanding_amount > 0
      ORDER BY outstanding_amount DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Get purchase summary by month
   * For trend analysis
   */
  async getPurchaseTrendByMonth(tenant_id: bigint, months: number = 12): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT 
        DATE_FORMAT(invoice_date, '%Y-%m') as month,
        COUNT(id) as purchase_count,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as paid_amount,
        AVG(total_amount) as avg_purchase_value
      FROM purchase_invoices
      WHERE tenant_id = ${tenant_id}
        AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)
      GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
      ORDER BY month DESC
    `;
  }

  /**
   * Get supplier payment history
   * Detailed ledger entries for a specific supplier
   */
  async getSupplierPaymentHistory(
    tenant_id: bigint,
    supplier_id: bigint,
    options?: {
      skip?: number;
      take?: number;
      from?: Date;
      to?: Date;
    }
  ): Promise<{ data: any[]; total: number }> {
    let dateFilter = Prisma.sql``;
    if (options?.from) {
      dateFilter = Prisma.sql`AND sl.created_at >= ${options.from}`;
    }
    if (options?.to) {
      dateFilter = Prisma.sql`${dateFilter} AND sl.created_at <= ${options.to}`;
    }

    const data = await prisma.$queryRaw<any[]>`
      SELECT 
        sl.id,
        sl.ref_type,
        sl.ref_id,
        sl.credit,
        sl.debit,
        sl.balance,
        sl.payment_mode,
        sl.description,
        sl.created_at,
        pi.invoice_number,
        pi.invoice_date
      FROM supplier_ledger sl
      LEFT JOIN purchase_invoices pi ON sl.ref_type = 'PURCHASE' AND sl.ref_id = pi.id
      WHERE sl.tenant_id = ${tenant_id}
        AND sl.supplier_id = ${supplier_id}
        ${dateFilter}
      ORDER BY sl.created_at DESC, sl.id DESC
      ${options?.take ? Prisma.sql`LIMIT ${options.take}` : Prisma.sql``}
      ${options?.skip ? Prisma.sql`OFFSET ${options.skip}` : Prisma.sql``}
    `;

    const countResult = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) as total
      FROM supplier_ledger
      WHERE tenant_id = ${tenant_id}
        AND supplier_id = ${supplier_id}
        ${dateFilter}
    `;

    return {
      data,
      total: Number(countResult[0]?.total || 0),
    };
  }
}
