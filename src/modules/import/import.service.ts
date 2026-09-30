import { ImportRepository } from './import.repository';
import { import_jobs, import_job_rows } from '@prisma/client';
import { parseFile } from '@utils/fileParser';
import { NotFoundError, BadRequestError } from '@utils/errors';
import { AuditLogger } from '@utils/auditLogger';
import { prisma } from '@config/database';
import { CategoryRepository } from '@modules/category/category.repository';
import { CustomerRepository } from '@modules/customer/customer.repository';
import { VariantRepository } from '@modules/product/product.repository';
import { logger } from '@utils/logger';
import { getFileStorage } from '@utils/storage';
import { config } from '@config/env';

export interface ImportJobResponse {
  id: string;
  type: string;
  status: string;
  file_url: string | null;
  created_at: Date | null;
  row_counts: {
    total: number;
    pending: number;
    valid: number;
    invalid: number;
    imported: number;
  };
}

export interface ImportJobDetailResponse extends ImportJobResponse {
  rows: Array<{
    row_no: number;
    status: string;
    error_message: string | null;
    data: any;
  }>;
  error_summary: Array<{
    row_no: number;
    error: string;
  }>;
}

export class ImportService {
  private readonly repository: ImportRepository;
  private readonly categoryRepo: CategoryRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly variantRepo: VariantRepository;

  constructor() {
    this.repository = new ImportRepository();
    this.categoryRepo = new CategoryRepository();
    this.customerRepo = new CustomerRepository();
    this.variantRepo = new VariantRepository();
  }

  /**
   * Create import job and parse file
   */
  async createImportJob(
    tenantId: bigint,
    userId: bigint,
    type: 'CUSTOMER' | 'PRODUCT' | 'INVENTORY' | 'CATEGORY' | 'SUPPLIER',
    fileKey: string,
    fileSize: bigint,
    fileMime: string,
    autoCreateCategories: boolean,
    ip?: string,
    userAgent?: string
  ): Promise<ImportJobResponse> {
    // Create job
    const job = await this.repository.createJob({
      tenant_id: tenantId,
      type,
      file_key: fileKey,
      file_size: fileSize,
      file_mime: fileMime,
    });

    // Audit log
    AuditLogger.create(
      tenantId,
      userId,
      'import_job',
      job.id,
      { type, file_key: fileKey },
      ip,
      userAgent
    );

    // Parse and validate in background
    process.nextTick(() => {
      this.parseAndValidateJob(job.id, tenantId, fileKey, type, autoCreateCategories).catch(
        (error) => {
          logger.error(`Error processing import job ${job.id}:`, error);
          this.repository
            .updateJob(job.id, { status: 'FAILED' })
            .catch((e) => logger.error('Failed to update job status:', e));
        }
      );
    });

    const counts = await this.repository.getRowCounts(job.id);

    return this.formatJobResponse(job, counts);
  }

  /**
   * Parse and validate job in background
   */
  private async parseAndValidateJob(
    jobId: bigint,
    tenantId: bigint,
    fileKey: string,
    type: string,
    autoCreateCategories: boolean
  ): Promise<void> {
    const storage = getFileStorage();

    try {
      // Update status to PROCESSING
      await this.repository.updateJob(jobId, { status: 'PROCESSING' });

      // Get job to retrieve file_mime
      const job = await this.repository.findJobById(jobId, tenantId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Get file stream from storage
      const fileStream = await storage.getStream(fileKey);

      // Parse file from stream using stored mime type or fallback to file extension
      const parseResult = await parseFile(fileStream, job.file_mime || fileKey);

      if (parseResult.rows.length === 0) {
        await this.repository.updateJob(jobId, { status: 'FAILED' });
        await storage.delete(fileKey); // Clean up file
        return;
      }

      // Create rows
      const rowsData = parseResult.rows.map((row) => ({
        import_job_id: jobId,
        row_no: row.rowNumber,
        raw_data: row.data,
        status: 'PENDING' as const,
      }));

      await this.repository.createRows(rowsData);

      // Validate rows
      await this.validateRows(jobId, tenantId, type, autoCreateCategories);

      // Update job status to COMPLETED
      await this.repository.updateJob(jobId, { status: 'COMPLETED' });

      // Clean up file in development mode after successful completion
      if (config.storageType === 'local') {
        try {
          await storage.delete(fileKey);
          logger.info(`Deleted file ${fileKey} after successful import`);
        } catch (cleanupError) {
          logger.error('Failed to cleanup file after completion:', cleanupError);
        }
      }
    } catch (error) {
      logger.error('Parse and validate error:', error);
      await this.repository.updateJob(jobId, { status: 'FAILED' });
      // Clean up file on error
      // Clean up file on error
      try {
        await storage.delete(fileKey);
      } catch (cleanupError) {
        logger.error('Failed to cleanup file:', cleanupError);
      }
    }
  }

  /**
   * Validate all rows
   */
  private async validateRows(
    jobId: bigint,
    tenantId: bigint,
    type: string,
    autoCreateCategories: boolean
  ): Promise<void> {
    const jobWithRows = await this.repository.findJobWithRows(jobId, tenantId);
    if (!jobWithRows) return;

    const validationPromises = jobWithRows.import_job_rows.map((row) =>
      this.validateRow(row, tenantId, type, autoCreateCategories)
    );

    await Promise.all(validationPromises);
  }

  /**
   * Validate single row
   */
  private async validateRow(
    row: import_job_rows,
    tenantId: bigint,
    type: string,
    autoCreateCategories: boolean
  ): Promise<void> {
    try {
      const data = row.raw_data as any;
      let error: string | null = null;

      switch (type) {
        case 'CUSTOMER':
          error = await this.validateCustomerRow(data, tenantId);
          break;
        case 'PRODUCT':
          error = await this.validateProductRow(data, tenantId, autoCreateCategories);
          break;
        case 'INVENTORY':
          error = await this.validateInventoryRow(data, tenantId);
          break;
        case 'CATEGORY':
          error = await this.validateCategoryRow(data, tenantId);
          break;
        case 'SUPPLIER':
          error = await this.validateSupplierRow(data, tenantId);
          break;
      }

      await this.repository.updateRow(row.id, {
        status: error ? 'INVALID' : 'VALID',
        error_message: error,
      });
    } catch (error: any) {
      await this.repository.updateRow(row.id, {
        status: 'INVALID',
        error_message: error.message || 'Validation failed',
      });
    }
  }

  /**
   * Validate customer row
   */
  private async validateCustomerRow(data: any, tenantId: bigint): Promise<string | null> {
    // Required fields
    if (!data.name || !data.phone) {
      return 'Name and phone are required';
    }

    // Validate phone format
    if (!/^\d{10}$/.test(data.phone)) {
      return 'Phone must be 10 digits';
    }

    // Check duplicate phone
    const existing = await this.customerRepo.findByPhone(data.phone, tenantId);
    if (existing) {
      return `Phone ${data.phone} already exists`;
    }

    // Validate email if provided
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return 'Invalid email format';
    }

    // Validate credit balance if provided
    if (data.credit_balance && isNaN(Number(data.credit_balance))) {
      return 'Credit balance must be a number';
    }

    return null;
  }

  /**
   * Validate product row (one variant per row)
   */
  private async validateProductRow(
    data: any,
    tenantId: bigint,
    autoCreateCategories: boolean
  ): Promise<string | null> {
    // Required fields
    if (!data.product_name || !data.category_name || !data.sku) {
      return 'Product name, category name, and SKU are required';
    }

    // Check category exists
    const category = await this.categoryRepo.findByName(data.category_name, tenantId);
    if (!category && !autoCreateCategories) {
      return `Category '${data.category_name}' not found. Enable auto-create or create manually`;
    }

    // Check duplicate SKU
    const existingVariant = await this.variantRepo.findVariantBySKU(data.sku, tenantId);
    if (existingVariant) {
      return `SKU ${data.sku} already exists`;
    }

    // Validate price
    if (!data.price || isNaN(Number(data.price)) || Number(data.price) <= 0) {
      return 'Valid price is required';
    }

    // Validate packaging if provided
    if (
      data.packaging &&
      !['POUCH', 'BOTTLE', 'CAN', 'BOX'].includes(data.packaging.toUpperCase())
    ) {
      return 'Packaging must be one of: POUCH, BOTTLE, CAN, BOX';
    }

    return null;
  }

  /**
   * Validate inventory row
   */
  private async validateInventoryRow(data: any, tenantId: bigint): Promise<string | null> {
    // Required fields
    if (!data.sku || !data.quantity) {
      return 'SKU and quantity are required';
    }

    // Check variant exists
    const variant = await this.variantRepo.findVariantBySKU(data.sku, tenantId);
    if (!variant) {
      return `Variant with SKU ${data.sku} not found`;
    }

    // Validate quantity
    if (isNaN(Number(data.quantity)) || Number(data.quantity) < 0) {
      return 'Quantity must be a non-negative number';
    }

    // Validate low stock threshold if provided
    if (data.low_stock_threshold && isNaN(Number(data.low_stock_threshold))) {
      return 'Low stock threshold must be a number';
    }

    return null;
  }

  /**
   * Validate category row
   */
  private async validateCategoryRow(data: any, tenantId: bigint): Promise<string | null> {
    // Required fields
    if (!data.name) {
      return 'Category name is required';
    }

    // Check duplicate name
    const existing = await this.categoryRepo.findByName(data.name, tenantId);
    if (existing) {
      return `Category '${data.name}' already exists`;
    }

    return null;
  }

  /**
   * Validate supplier row
   */
  private async validateSupplierRow(
    data: any,
    tenantId: bigint
  ): Promise<string | null> {
    // Required fields
    if (!data.name) {
      return 'Supplier name is required';
    }

    // Validate phone format if provided
    if (data.phone && !/^\d{10,20}$/.test(data.phone)) {
      return 'Phone must be 10-20 digits';
    }

    // Check duplicate phone if provided
    if (data.phone) {
      const existing = await prisma.suppliers.findFirst({
        where: { phone: data.phone, tenant_id: tenantId },
      });
      if (existing) {
        return `Supplier with phone ${data.phone} already exists`;
      }
    }

    // Validate email if provided
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return 'Invalid email format';
    }

    return null;
  }

  /**
   * Get import job details
   */
  async getImportJob(jobId: bigint, tenantId: bigint): Promise<ImportJobDetailResponse> {
    const job = await this.repository.findJobWithRows(jobId, tenantId);
    if (!job) {
      throw new NotFoundError('Import job not found');
    }

    const counts = await this.repository.getRowCounts(jobId);

    const rows = job.import_job_rows.map((row) => ({
      row_no: row.row_no,
      status: row.status || 'PENDING',
      error_message: row.error_message,
      data: row.raw_data,
    }));

    const error_summary = job.import_job_rows
      .filter((row) => row.status === 'INVALID' && row.error_message)
      .map((row) => ({
        row_no: row.row_no,
        error: row.error_message!,
      }));

    return {
      ...this.formatJobResponse(job, counts),
      rows,
      error_summary,
    };
  }

  /**
   * Get all import jobs
   */
  async getImportJobs(
    tenantId: bigint,
    options: {
      page: number;
      limit: number;
      type?: 'CUSTOMER' | 'PRODUCT' | 'INVENTORY' | 'CATEGORY';
      status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    }
  ): Promise<{
    jobs: ImportJobResponse[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const { jobs, total } = await this.repository.findAllByTenant(tenantId, options);

    const jobResponses = await Promise.all(
      jobs.map(async (job) => {
        const counts = await this.repository.getRowCounts(job.id);
        return this.formatJobResponse(job, counts);
      })
    );

    return {
      jobs: jobResponses,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit),
      },
    };
  }

  /**
   * Commit import job (import valid rows only)
   */
  async commitImportJob(
    jobId: bigint,
    tenantId: bigint,
    userId: bigint,
    ip?: string,
    userAgent?: string
  ): Promise<{ imported: number; failed: number; errors: any[] }> {
    const job = await this.repository.findJobById(jobId, tenantId);
    if (!job) {
      throw new NotFoundError('Import job not found');
    }

    if (job.status !== 'COMPLETED') {
      throw new BadRequestError('Job must be completed before committing');
    }

    const validRows = await this.repository.getValidRows(jobId);
    if (validRows.length === 0) {
      throw new BadRequestError('No valid rows to import');
    }

    let imported = 0;
    let failed = 0;
    const errors: any[] = [];

    // Import rows one by one to prevent partial failures
    for (const row of validRows) {
      try {
        await this.importRow(row, tenantId, job.type as string, userId);
        await this.repository.updateRow(row.id, { status: 'IMPORTED' });
        imported++;
      } catch (error: any) {
        await this.repository.updateRow(row.id, {
          status: 'INVALID',
          error_message: error.message || 'Import failed',
        });
        errors.push({ row_no: row.row_no, error: error.message });
        failed++;
      }
    }

    // Audit log
    AuditLogger.statusChange(
      tenantId,
      userId,
      'import_job',
      jobId,
      { status: job.status, type: job.type },
      { status: 'COMMITTED', imported, failed },
      ip,
      userAgent
    );

    return { imported, failed, errors };
  }

  /**
   * Import single row into business tables
   */
  private async importRow(
    row: import_job_rows,
    tenantId: bigint,
    type: string,
    userId: bigint
  ): Promise<void> {
    const data = row.raw_data as any;

    switch (type) {
      case 'CUSTOMER':
        await this.importCustomerRow(data, tenantId, userId);
        break;
      case 'PRODUCT':
        await this.importProductRow(data, tenantId, userId);
        break;
      case 'INVENTORY':
        await this.importInventoryRow(data, tenantId);
        break;
      case 'CATEGORY':
        await this.importCategoryRow(data, tenantId, userId);
        break;
      case 'SUPPLIER':
        await this.importSupplierRow(data, tenantId, userId);
        break;
    }
  }

  /**
   * Import customer row
   */
  private async importCustomerRow(data: any, tenantId: bigint, userId: bigint): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // Check again for duplicates (idempotency)
      const existing = await tx.customer.findFirst({
        where: { phone: data.phone, tenant_id: tenantId },
      });
      if (existing) {
        throw new Error(`Customer with phone ${data.phone} already exists`);
      }

      // Create customer
      const customer = await tx.customer.create({
        data: {
          tenant_id: tenantId,
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          is_active: true,
        },
      });

      // Create opening balance ledger entry if credit_balance provided
      const creditBalance = Number(data.credit_balance || 0);
      if (creditBalance !== 0) {
        const existingLedger = await tx.customer_ledger.findFirst({
          where: {
            customer_id: customer.id,
            entry_type: 'OPENING_BALANCE',
          },
        });

        if (!existingLedger) {
          await tx.customer_ledger.create({
            data: {
              tenant_id: tenantId,
              customer_id: customer.id,
              entry_type: 'OPENING_BALANCE',
              amount: creditBalance,
              description: 'Opening balance from import',
              created_by: userId,
            },
          });
        }
      }

      // Audit log
      AuditLogger.create(tenantId, userId, 'customer', customer.id, {
        name: data.name,
        phone: data.phone,
        source: 'import',
      });
    });
  }

  /**
   * Import product row (creates product and variant)
   */
  private async importProductRow(data: any, tenantId: bigint, userId: bigint): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // Get or create category
      let category = await tx.categories.findFirst({
        where: { name: data.category_name, tenant_id: tenantId },
      });

      if (!category) {
        category = await tx.categories.create({
          data: {
            tenant_id: tenantId,
            name: data.category_name,
            is_active: true,
          },
        });

        AuditLogger.create(tenantId, userId, 'category', category.id, {
          name: data.category_name,
          source: 'auto_import',
        });
      }

      // Check if product exists
      let product = await tx.product.findFirst({
        where: { name: data.product_name, tenant_id: tenantId },
      });

      if (!product) {
        product = await tx.product.create({
          data: {
            tenant_id: tenantId,
            name: data.product_name,
            category_id: category.id,
            is_active: true,
          },
        });

        AuditLogger.create(tenantId, userId, 'product', product.id, {
          name: data.product_name,
          category_id: category.id,
          source: 'import',
        });
      }

      // Check SKU duplicate again (idempotency)
      const existingVariant = await tx.product_variants.findFirst({
        where: { sku: data.sku, tenant_id: tenantId },
      });
      if (existingVariant) {
        throw new Error(`Variant with SKU ${data.sku} already exists`);
      }

      // Determine selling price (use selling_price if provided, else use price)
      const sellingPrice = data.selling_price ? Number(data.selling_price) : Number(data.price);
      const mrpPrice = data.mrp_price ? Number(data.mrp_price) : sellingPrice * 1.1;
      const gstPercent = data.gst_percent ? Number(data.gst_percent) : 5.0;

      // Create variant
      const variant = await tx.product_variants.create({
        data: {
          tenant_id: tenantId,
          product_id: product.id,
          brand: data.brand || null,
          size: data.size || null,
          packaging: data.packaging?.toUpperCase() || null,
          price: Number(data.price),
          selling_price: sellingPrice,
          mrp_price: mrpPrice,
          gst_percent: gstPercent,
          sku: data.sku,
          image_url: data.image_url || null,
          is_active: true,
        },
      });

      AuditLogger.create(
        tenantId,
        userId,
        'product_variant',
        variant.id,
        {
          product_id: product.id,
          sku: data.sku,
          price: data.price,
          selling_price: sellingPrice,
          source: 'import',
        }
      );

      // Create or update inventory if quantity provided
      if (data.quantity !== undefined && data.quantity !== null) {
        const quantity = Number(data.quantity);
        const lowStockThreshold = data.low_stock_threshold 
          ? Number(data.low_stock_threshold) 
          : 5;

        const existingInventory = await tx.inventory.findFirst({
          where: { variant_id: variant.id },
        });

        if (existingInventory) {
          await tx.inventory.update({
            where: { variant_id: variant.id },
            data: {
              quantity,
              low_stock_threshold: lowStockThreshold,
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              tenant_id: tenantId,
              variant_id: variant.id,
              quantity,
              low_stock_threshold: lowStockThreshold,
            },
          });
        }
      }
    });
  }

  /**
   * Import inventory row
   */
  private async importInventoryRow(data: any, tenantId: bigint): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // Find variant
      const variant = await tx.product_variants.findFirst({
        where: { sku: data.sku, tenant_id: tenantId },
      });

      if (!variant) {
        throw new Error(`Variant with SKU ${data.sku} not found`);
      }

      // Check if inventory exists
      const existing = await tx.inventory.findFirst({
        where: { variant_id: variant.id },
      });

      if (existing) {
        // Update existing inventory
        await tx.inventory.update({
          where: { variant_id: existing.variant_id },
          data: {
            quantity: Number(data.quantity),
            low_stock_threshold: data.low_stock_threshold
              ? Number(data.low_stock_threshold)
              : existing.low_stock_threshold,
          },
        });
      } else {
        // Create new inventory
        await tx.inventory.create({
          data: {
            tenant_id: tenantId,
            variant_id: variant.id,
            quantity: Number(data.quantity),
            low_stock_threshold: data.low_stock_threshold ? Number(data.low_stock_threshold) : 10,
          },
        });
      }
    });
  }

  /**
   * Import category row
   */
  private async importCategoryRow(data: any, tenantId: bigint, userId: bigint): Promise<void> {
    // Check duplicate again (idempotency)
    const existing = await this.categoryRepo.findByName(data.name, tenantId);
    if (existing) {
      throw new Error(`Category '${data.name}' already exists`);
    }

    const category = await prisma.categories.create({
      data: {
        tenant_id: tenantId,
        name: data.name,
        is_active: true,
      },
    });

    AuditLogger.create(tenantId, userId, 'category', category.id, {
      name: data.name,
      source: 'import',
    });
  }

  /**
   * Import supplier row
   */
  private async importSupplierRow(
    data: any,
    tenantId: bigint,
    userId: bigint
  ): Promise<void> {
    // Check duplicate phone again (idempotency)
    if (data.phone) {
      const existing = await prisma.suppliers.findFirst({
        where: { phone: data.phone, tenant_id: tenantId },
      });
      if (existing) {
        throw new Error(`Supplier with phone ${data.phone} already exists`);
      }
    }

    const supplier = await prisma.suppliers.create({
      data: {
        tenant_id: tenantId,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        is_active: true,
      },
    });

    AuditLogger.create(
      tenantId,
      userId,
      'supplier',
      supplier.id,
      { name: data.name, phone: data.phone, source: 'import' }
    );
  }

  /**
   * Format job response
   */
  private formatJobResponse(
    job: import_jobs,
    counts: {
      total: number;
      pending: number;
      valid: number;
      invalid: number;
      imported: number;
    }
  ): ImportJobResponse {
    return {
      id: job.id.toString(),
      type: job.type || 'UNKNOWN',
      status: job.status || 'PENDING',
      file_url: job.file_key || job.file_url, // Use file_key, fallback to file_url for backward compatibility
      created_at: job.created_at,
      row_counts: counts,
    };
  }
}
