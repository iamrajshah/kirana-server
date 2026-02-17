import { Request, Response } from 'express';
import { ImportService } from './import.service';
import { asyncHandler } from '@utils/asyncHandler';
import { AuthRequest } from '@middlewares/auth.middleware';
import { BadRequestError } from '@utils/errors';
import { generateCSV, generateExcel } from '@utils/fileParser';
import { prisma } from '@config/database';
import { getFileStorage } from '@utils/storage';

export class ImportController {
  private readonly service: ImportService;

  constructor() {
    this.service = new ImportService();
  }

  /**
   * Upload and create import job
   * POST /api/import/upload
   */
  uploadFile = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const file = req.file;

    if (!file) {
      throw new BadRequestError('File is required');
    }

    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    // Upload file to storage
    const storage = getFileStorage();
    const fileMetadata = await storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      tenantId: tenantId.toString(),
      mimeType: file.mimetype,
    });

    const result = await this.service.createImportJob(
      tenantId,
      userId,
      req.body.type,
      fileMetadata.key,
      BigInt(fileMetadata.size),
      fileMetadata.mimeType,
      req.body.autoCreateCategories,
      ip,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded. Processing in background.',
      data: result,
    });
  });

  /**
   * Get import job details
   * GET /api/import/:jobId
   */
  getJob = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);

    const result = await this.service.getImportJob(BigInt(req.params.jobId), tenantId);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * Get all import jobs
   * GET /api/import
   */
  getJobs = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);

    const result = await this.service.getImportJobs(tenantId, {
      page: parseInt((req.query.page as string) || '1'),
      limit: parseInt((req.query.limit as string) || '20'),
      type: req.query.type as any,
      status: req.query.status as any,
    });

    res.status(200).json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  });

  /**
   * Commit import job (import valid rows)
   * POST /api/import/:jobId/commit
   */
  commitJob = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const userId = BigInt(user!.userId);

    const ip = (req.ip || req.connection?.remoteAddress)?.toString();
    const userAgent = req.headers['user-agent'];

    const result = await this.service.commitImportJob(
      BigInt(req.params.jobId),
      tenantId,
      userId,
      ip,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: `Import completed. ${result.imported} rows imported, ${result.failed} failed.`,
      data: result,
    });
  });

  /**
   * Export data to CSV/Excel
   * POST /api/import/export
   */
  exportData = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);

    let data: any[] = [];
    let headers: string[] = [];
    let filename: string = '';

    switch (req.body.type) {
      case 'CUSTOMER':
        const customers = await prisma.customer.findMany({
          where: { tenant_id: tenantId, is_active: true },
          select: {
            name: true,
            phone: true,
            email: true,
          },
        });
        data = customers;
        headers = ['name', 'phone', 'email'];
        filename = `customers_${Date.now()}`;
        break;

      case 'PRODUCT':
        const variants = await prisma.product_variants.findMany({
          where: { tenant_id: tenantId, is_active: true },
          include: {
            products: {
              include: {
                categories: true,
              },
            },
          },
        });
        data = variants.map((v) => ({
          product_name: v.products.name,
          category_name: v.products.categories?.name || '',
          brand: v.brand || '',
          size: v.size || '',
          packaging: v.packaging || '',
          price: v.price,
          sku: v.sku,
        }));
        headers = ['product_name', 'category_name', 'brand', 'size', 'packaging', 'price', 'sku'];
        filename = `products_${Date.now()}`;
        break;

      case 'INVENTORY':
        const inventory = await prisma.inventory.findMany({
          where: {
            product_variants: {
              tenant_id: tenantId,
            },
          },
          include: {
            product_variants: true,
          },
        });
        data = inventory.map((inv) => ({
          sku: inv.product_variants.sku,
          quantity: inv.quantity,
          low_stock_threshold: inv.low_stock_threshold,
        }));
        headers = ['sku', 'quantity', 'low_stock_threshold'];
        filename = `inventory_${Date.now()}`;
        break;

      case 'CATEGORY':
        const categories = await prisma.categories.findMany({
          where: { tenant_id: tenantId, is_active: true },
          select: {
            name: true,
          },
        });
        data = categories;
        headers = ['name'];
        filename = `categories_${Date.now()}`;
        break;
    }

    if (req.body.format === 'EXCEL') {
      const buffer = generateExcel(data, headers);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      const csv = generateCSV(data, headers);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    }
  });

  /**
   * Export customers
   * GET /api/export/customers
   */
  exportCustomers = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const filename = `customers_${Date.now()}`;

    if ((req.query.format as string) === 'EXCEL') {
      // Excel: Load all data (Excel format requires full file construction)
      const customers = await prisma.customer.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { name: true, phone: true, email: true },
      });
      const headers = ['name', 'phone', 'email'];
      const buffer = generateExcel(customers, headers);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      // CSV: Stream data in batches for memory efficiency
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.write('name,phone,email\n');

      const batchSize = 1000;
      let skip = 0;

      while (true) {
        const batch = await prisma.customer.findMany({
          where: { tenant_id: tenantId, is_active: true },
          select: { name: true, phone: true, email: true },
          skip,
          take: batchSize,
          orderBy: { id: 'asc' },
        });

        if (batch.length === 0) break;

        for (const customer of batch) {
          const name = (customer.name || '').replace(/"/g, '""');
          const phone = (customer.phone || '').replace(/"/g, '""');
          const email = (customer.email || '').replace(/"/g, '""');
          res.write(`"${name}","${phone}","${email}"\n`);
        }

        skip += batchSize;
        if (batch.length < batchSize) break;
      }

      res.end();
    }
  });

  /**
   * Export products
   * GET /api/export/products
   */
  exportProducts = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const filename = `products_${Date.now()}`;

    if ((req.query.format as string) === 'EXCEL') {
      const variants = await prisma.product_variants.findMany({
        where: { tenant_id: tenantId, is_active: true },
        include: {
          products: { include: { categories: true } },
        },
      });
      const data = variants.map((v) => ({
        product_name: v.products.name,
        category_name: v.products.categories?.name || '',
        brand: v.brand || '',
        size: v.size || '',
        packaging: v.packaging || '',
        price: v.price,
        sku: v.sku,
      }));
      const headers = [
        'product_name',
        'category_name',
        'brand',
        'size',
        'packaging',
        'price',
        'sku',
      ];
      const buffer = generateExcel(data, headers);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.write('product_name,category_name,brand,size,packaging,price,sku\n');

      const batchSize = 1000;
      let skip = 0;

      while (true) {
        const batch = await prisma.product_variants.findMany({
          where: { tenant_id: tenantId, is_active: true },
          include: { products: { include: { categories: true } } },
          skip,
          take: batchSize,
          orderBy: { id: 'asc' },
        });

        if (batch.length === 0) break;

        for (const v of batch) {
          const productName = (v.products.name || '').replace(/"/g, '""');
          const categoryName = (v.products.categories?.name || '').replace(/"/g, '""');
          const brand = (v.brand || '').replace(/"/g, '""');
          const size = (v.size || '').replace(/"/g, '""');
          const packaging = (v.packaging || '').replace(/"/g, '""');
          const price = v.price?.toString() || '0';
          const sku = (v.sku || '').replace(/"/g, '""');
          res.write(
            `"${productName}","${categoryName}","${brand}","${size}","${packaging}","${price}","${sku}"\n`
          );
        }

        skip += batchSize;
        if (batch.length < batchSize) break;
      }

      res.end();
    }
  });

  /**
   * Export inventory
   * GET /api/export/inventory
   */
  exportInventory = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const filename = `inventory_${Date.now()}`;

    if ((req.query.format as string) === 'EXCEL') {
      const inventory = await prisma.inventory.findMany({
        where: { product_variants: { tenant_id: tenantId } },
        include: { product_variants: true },
      });
      const data = inventory.map((inv) => ({
        sku: inv.product_variants.sku,
        quantity: inv.quantity,
        low_stock_threshold: inv.low_stock_threshold,
      }));
      const headers = ['sku', 'quantity', 'low_stock_threshold'];
      const buffer = generateExcel(data, headers);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.write('sku,quantity,low_stock_threshold\n');

      const batchSize = 1000;
      let skip = 0;

      while (true) {
        const batch = await prisma.inventory.findMany({
          where: { product_variants: { tenant_id: tenantId } },
          include: { product_variants: true },
          skip,
          take: batchSize,
          orderBy: { variant_id: 'asc' },
        });

        if (batch.length === 0) break;

        for (const inv of batch) {
          const sku = (inv.product_variants.sku || '').replace(/"/g, '""');
          const quantity = inv.quantity?.toString() || '0';
          const threshold = inv.low_stock_threshold?.toString() || '0';
          res.write(`"${sku}","${quantity}","${threshold}"\n`);
        }

        skip += batchSize;
        if (batch.length < batchSize) break;
      }

      res.end();
    }
  });

  /**
   * Export invoices
   * GET /api/export/invoices
   */
  exportInvoices = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const filename = `invoices_${Date.now()}`;

    if ((req.query.format as string) === 'EXCEL') {
      const invoices = await prisma.invoice.findMany({
        where: { tenant_id: tenantId },
        include: { customers: { select: { name: true, phone: true } } },
        orderBy: { created_at: 'desc' },
      });
      const data = invoices.map((inv) => ({
        invoice_number: inv.invoice_number,
        customer_name: inv.customers?.name || '',
        customer_phone: inv.customers?.phone || '',
        total_amount: inv.total_amount,
        gst_amount: inv.gst_amount,
        status: inv.status,
        created_at: inv.created_at?.toISOString(),
      }));
      const headers = [
        'invoice_number',
        'customer_name',
        'customer_phone',
        'total_amount',
        'gst_amount',
        'status',
        'created_at',
      ];
      const buffer = generateExcel(data, headers);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.write(
        'invoice_number,customer_name,customer_phone,total_amount,gst_amount,status,created_at\n'
      );

      const batchSize = 1000;
      let skip = 0;

      while (true) {
        const batch = await prisma.invoice.findMany({
          where: { tenant_id: tenantId },
          include: { customers: { select: { name: true, phone: true } } },
          orderBy: { created_at: 'desc' },
          skip,
          take: batchSize,
        });

        if (batch.length === 0) break;

        for (const inv of batch) {
          const invoiceNumber = (inv.invoice_number || '').replace(/"/g, '""');
          const customerName = (inv.customers?.name || '').replace(/"/g, '""');
          const customerPhone = (inv.customers?.phone || '').replace(/"/g, '""');
          const totalAmount = inv.total_amount?.toString() || '0';
          const gstAmount = inv.gst_amount?.toString() || '0';
          const status = inv.status || '';
          const createdAt = inv.created_at?.toISOString() || '';
          res.write(
            `"${invoiceNumber}","${customerName}","${customerPhone}","${totalAmount}","${gstAmount}","${status}","${createdAt}"\n`
          );
        }

        skip += batchSize;
        if (batch.length < batchSize) break;
      }

      res.end();
    }
  });

  /**
   * Export customer ledger
   * GET /api/export/ledger
   */
  exportLedger = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const tenantId = BigInt(user!.tenantId);
    const filename = `ledger_${Date.now()}`;

    if ((req.query.format as string) === 'EXCEL') {
      const ledgerEntries = await prisma.customer_ledger.findMany({
        where: { tenant_id: tenantId },
        include: { customers: { select: { name: true, phone: true } } },
        orderBy: { created_at: 'desc' },
      });
      const data = ledgerEntries.map((entry) => ({
        customer_name: entry.customers?.name || '',
        customer_phone: entry.customers?.phone || '',
        entry_type: entry.entry_type,
        amount: entry.amount,
        description: entry.description || '',
        created_at: entry.created_at?.toISOString(),
      }));
      const headers = [
        'customer_name',
        'customer_phone',
        'entry_type',
        'amount',
        'description',
        'created_at',
      ];
      const buffer = generateExcel(data, headers);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.write('customer_name,customer_phone,entry_type,amount,description,created_at\n');

      const batchSize = 1000;
      let skip = 0;

      while (true) {
        const batch = await prisma.customer_ledger.findMany({
          where: { tenant_id: tenantId },
          include: { customers: { select: { name: true, phone: true } } },
          orderBy: { created_at: 'desc' },
          skip,
          take: batchSize,
        });

        if (batch.length === 0) break;

        for (const entry of batch) {
          const customerName = (entry.customers?.name || '').replace(/"/g, '""');
          const customerPhone = (entry.customers?.phone || '').replace(/"/g, '""');
          const entryType = entry.entry_type || '';
          const amount = entry.amount?.toString() || '0';
          const description = (entry.description || '').replace(/"/g, '""');
          const createdAt = entry.created_at?.toISOString() || '';
          res.write(
            `"${customerName}","${customerPhone}","${entryType}","${amount}","${description}","${createdAt}"\n`
          );
        }

        skip += batchSize;
        if (batch.length < batchSize) break;
      }

      res.end();
    }
  });
}
