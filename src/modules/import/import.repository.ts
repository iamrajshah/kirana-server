import { prisma } from '@config/database';
import { import_jobs, import_job_rows, Prisma } from '@prisma/client';

export interface CreateImportJobData {
  tenant_id: bigint;
  type: 'CUSTOMER' | 'PRODUCT' | 'INVENTORY' | 'CATEGORY';
  file_key: string;
  file_size?: bigint;
  file_mime?: string;
  file_url?: string; // Deprecated, keep for backward compatibility
}

export interface CreateImportJobRowData {
  import_job_id: bigint;
  row_no: number;
  raw_data: any;
  status?: 'PENDING' | 'VALID' | 'INVALID' | 'IMPORTED';
  error_message?: string;
}

export interface UpdateImportJobData {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  file_url?: string;
}

export interface UpdateImportJobRowData {
  status?: 'PENDING' | 'VALID' | 'INVALID' | 'IMPORTED';
  error_message?: string | null;
}

export class ImportRepository {
  /**
   * Create import job
   */
  async createJob(data: CreateImportJobData): Promise<import_jobs> {
    return prisma.import_jobs.create({
      data: {
        tenant_id: data.tenant_id,
        type: data.type as any,
        status: 'PENDING',
        file_key: data.file_key,
        file_size: data.file_size,
        file_mime: data.file_mime,
        file_url: data.file_url,
      },
    });
  }

  /**
   * Find import job by ID and tenant
   */
  async findJobById(jobId: bigint, tenantId: bigint): Promise<import_jobs | null> {
    return prisma.import_jobs.findFirst({
      where: {
        id: jobId,
        tenant_id: tenantId,
      },
    });
  }

  /**
   * Find import job with rows
   */
  async findJobWithRows(
    jobId: bigint,
    tenantId: bigint
  ): Promise<
    | (import_jobs & {
        import_job_rows: import_job_rows[];
      })
    | null
  > {
    return prisma.import_jobs.findFirst({
      where: {
        id: jobId,
        tenant_id: tenantId,
      },
      include: {
        import_job_rows: {
          orderBy: {
            row_no: 'asc',
          },
        },
      },
    });
  }

  /**
   * Get all import jobs for tenant with pagination
   */
  async findAllByTenant(
    tenantId: bigint,
    options: {
      page: number;
      limit: number;
      type?: 'CUSTOMER' | 'PRODUCT' | 'INVENTORY' | 'CATEGORY';
      status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    }
  ): Promise<{ jobs: import_jobs[]; total: number }> {
    const where: Prisma.import_jobsWhereInput = {
      tenant_id: tenantId,
      ...(options.type && { type: options.type as any }),
      ...(options.status && { status: options.status as any }),
    };

    const [jobs, total] = await Promise.all([
      prisma.import_jobs.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      prisma.import_jobs.count({ where }),
    ]);

    return { jobs, total };
  }

  /**
   * Update import job
   */
  async updateJob(jobId: bigint, data: UpdateImportJobData): Promise<import_jobs> {
    return prisma.import_jobs.update({
      where: { id: jobId },
      data: data as any,
    });
  }

  /**
   * Create import job rows in batch
   */
  async createRows(rows: CreateImportJobRowData[]): Promise<number> {
    const result = await prisma.import_job_rows.createMany({
      data: rows.map((row) => ({
        import_job_id: row.import_job_id,
        row_no: row.row_no,
        raw_data: row.raw_data as any,
        status: (row.status || 'PENDING') as any,
        error_message: row.error_message,
      })),
    });

    return result.count;
  }

  /**
   * Update import job row
   */
  async updateRow(
    rowId: bigint,
    data: UpdateImportJobRowData
  ): Promise<import_job_rows> {
    return prisma.import_job_rows.update({
      where: { id: rowId },
      data: data as any,
    });
  }

  /**
   * Update multiple rows
   */
  async updateManyRows(
    jobId: bigint,
    rowIds: bigint[],
    data: UpdateImportJobRowData
  ): Promise<number> {
    const result = await prisma.import_job_rows.updateMany({
      where: {
        id: { in: rowIds },
        import_job_id: jobId,
      },
      data: data as any,
    });

    return result.count;
  }

  /**
   * Get row counts by status
   */
  async getRowCounts(jobId: bigint): Promise<{
    total: number;
    pending: number;
    valid: number;
    invalid: number;
    imported: number;
  }> {
    const [total, pending, valid, invalid, imported] = await Promise.all([
      prisma.import_job_rows.count({ where: { import_job_id: jobId } }),
      prisma.import_job_rows.count({
        where: { import_job_id: jobId, status: 'PENDING' },
      }),
      prisma.import_job_rows.count({
        where: { import_job_id: jobId, status: 'VALID' },
      }),
      prisma.import_job_rows.count({
        where: { import_job_id: jobId, status: 'INVALID' },
      }),
      prisma.import_job_rows.count({
        where: { import_job_id: jobId, status: 'IMPORTED' },
      }),
    ]);

    return { total, pending, valid, invalid, imported };
  }

  /**
   * Get valid rows for commit
   */
  async getValidRows(jobId: bigint): Promise<import_job_rows[]> {
    return prisma.import_job_rows.findMany({
      where: {
        import_job_id: jobId,
        status: 'VALID',
      },
      orderBy: {
        row_no: 'asc',
      },
    });
  }

  /**
   * Get invalid rows with errors
   */
  async getInvalidRows(jobId: bigint): Promise<import_job_rows[]> {
    return prisma.import_job_rows.findMany({
      where: {
        import_job_id: jobId,
        status: 'INVALID',
      },
      orderBy: {
        row_no: 'asc',
      },
    });
  }
}
