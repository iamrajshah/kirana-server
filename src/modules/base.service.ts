/**
 * Base service class
 */
export abstract class BaseService<T, TCreate, TUpdate> {
  protected abstract readonly repository: {
    findAll: (tenantId: string, options?: { skip?: number; take?: number }) => Promise<T[]>;
    findById: (id: string, tenantId: string) => Promise<T | null>;
    findByIdOrFail: (id: string, tenantId: string) => Promise<T>;
    create: (tenantId: string, data: TCreate) => Promise<T>;
    update: (id: string, tenantId: string, data: TUpdate) => Promise<T>;
    delete: (id: string, tenantId: string) => Promise<T>;
    count: (tenantId: string, where?: unknown) => Promise<number>;
  };

  /**
   * Get all records
   */
  async getAll(tenantId: string, options?: { skip?: number; take?: number }): Promise<T[]> {
    return this.repository.findAll(tenantId, options);
  }

  /**
   * Get record by ID
   */
  async getById(id: string, tenantId: string): Promise<T | null> {
    return this.repository.findById(id, tenantId);
  }

  /**
   * Get record by ID or throw error
   */
  async getByIdOrFail(id: string, tenantId: string): Promise<T> {
    return this.repository.findByIdOrFail(id, tenantId);
  }

  /**
   * Create a new record
   */
  async create(tenantId: string, data: TCreate): Promise<T> {
    return this.repository.create(tenantId, data);
  }

  /**
   * Update a record
   */
  async update(id: string, tenantId: string, data: TUpdate): Promise<T> {
    return this.repository.update(id, tenantId, data);
  }

  /**
   * Delete a record
   */
  async delete(id: string, tenantId: string): Promise<T> {
    return this.repository.delete(id, tenantId);
  }

  /**
   * Count records
   */
  async count(tenantId: string, where?: unknown): Promise<number> {
    return this.repository.count(tenantId, where);
  }
}
