import { PrismaClient } from '@prisma/client';
import { prisma } from '@config/database';
import { NotFoundError } from '@utils/errors';

/**
 * Base repository class with tenant isolation
 */
export abstract class BaseRepository<T, TCreate, TUpdate> {
  protected readonly prisma: PrismaClient;
  protected abstract readonly model: string;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Get Prisma delegate for the model
   */
  protected abstract getDelegate(): {
    findMany: (args?: unknown) => Promise<T[]>;
    findUnique: (args: unknown) => Promise<T | null>;
    findFirst: (args: unknown) => Promise<T | null>;
    create: (args: unknown) => Promise<T>;
    update: (args: unknown) => Promise<T>;
    delete: (args: unknown) => Promise<T>;
    count: (args?: unknown) => Promise<number>;
  };

  /**
   * Add tenant filter to where clause
   */
  protected withTenant<W>(tenantId: string, where?: W): W & { tenantId: string } {
    return {
      ...where,
      tenantId,
    } as W & { tenantId: string };
  }

  /**
   * Find all records for a tenant
   */
  async findAll(tenantId: string, options?: { skip?: number; take?: number }): Promise<T[]> {
    return this.getDelegate().findMany({
      where: { tenantId },
      skip: options?.skip,
      take: options?.take,
    } as never);
  }

  /**
   * Find record by ID with tenant isolation
   */
  async findById(id: string, tenantId: string): Promise<T | null> {
    return this.getDelegate().findFirst({
      where: this.withTenant(tenantId, { id } as never),
    } as never);
  }

  /**
   * Find record by ID or throw error
   */
  async findByIdOrFail(id: string, tenantId: string): Promise<T> {
    const record = await this.findById(id, tenantId);
    if (!record) {
      throw new NotFoundError(`${this.model} not found`);
    }
    return record;
  }

  /**
   * Create a new record with tenant
   */
  async create(tenantId: string, data: TCreate): Promise<T> {
    return this.getDelegate().create({
      data: {
        ...data,
        tenantId,
      } as never,
    } as never);
  }

  /**
   * Update a record with tenant isolation
   */
  async update(id: string, tenantId: string, data: TUpdate): Promise<T> {
    await this.findByIdOrFail(id, tenantId);
    return this.getDelegate().update({
      where: { id },
      data: data as never,
    } as never);
  }

  /**
   * Delete a record with tenant isolation
   */
  async delete(id: string, tenantId: string): Promise<T> {
    await this.findByIdOrFail(id, tenantId);
    return this.getDelegate().delete({
      where: { id },
    } as never);
  }

  /**
   * Count records for a tenant
   */
  async count(tenantId: string, where?: unknown): Promise<number> {
    return this.getDelegate().count({
      where: this.withTenant(tenantId, where as never),
    } as never);
  }
}
