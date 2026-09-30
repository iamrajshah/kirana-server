import { prisma } from '@config/database';
import { logger } from './logger';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'STATUS_CHANGE';

export interface AuditLogData {
  tenant_id: bigint;
  user_id: bigint;
  entity_type: string;
  entity_id: bigint;
  action: AuditAction;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Audit Logger - Non-blocking activity logging
 * Logs important actions (CREATE, UPDATE, DELETE, CANCEL, STATUS_CHANGE)
 * Does NOT log GET/READ operations
 */
export class AuditLogger {
  /**
   * Log an activity asynchronously (non-blocking)
   * Errors in audit logging will not affect the main operation
   */
  static log(data: AuditLogData): void {
    // Execute audit log creation asynchronously without blocking
    // Using process.nextTick to ensure it executes in the next event loop iteration
    process.nextTick(async () => {
      try {
        await prisma.activity_logs.create({
          data: {
            tenant_id: data.tenant_id,
            user_id: data.user_id,
            entity_type: data.entity_type,
            entity_id: data.entity_id,
            action: data.action,
            old_value: data.old_value || null,
            new_value: data.new_value || null,
            ip_address: data.ip_address || null,
            user_agent: data.user_agent || null,
          },
        });
      } catch (error) {
        // Log the error but don't throw - audit logging should never break the main flow
        logger.error('Audit logging failed:', error);
      }
    });
  }

  /**
   * Log CREATE action
   */
  static create(
    tenant_id: bigint,
    user_id: bigint,
    entity_type: string,
    entity_id: bigint,
    new_value?: any,
    ip_address?: string,
    user_agent?: string
  ): void {
    this.log({
      tenant_id,
      user_id,
      entity_type,
      entity_id,
      action: 'CREATE',
      new_value,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log UPDATE action
   */
  static update(
    tenant_id: bigint,
    user_id: bigint,
    entity_type: string,
    entity_id: bigint,
    old_value?: any,
    new_value?: any,
    ip_address?: string,
    user_agent?: string
  ): void {
    this.log({
      tenant_id,
      user_id,
      entity_type,
      entity_id,
      action: 'UPDATE',
      old_value,
      new_value,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log DELETE action
   */
  static delete(
    tenant_id: bigint,
    user_id: bigint,
    entity_type: string,
    entity_id: bigint,
    old_value?: any,
    ip_address?: string,
    user_agent?: string
  ): void {
    this.log({
      tenant_id,
      user_id,
      entity_type,
      entity_id,
      action: 'DELETE',
      old_value,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log STATUS_CHANGE action
   */
  static statusChange(
    tenant_id: bigint,
    user_id: bigint,
    entity_type: string,
    entity_id: bigint,
    old_value?: any,
    new_value?: any,
    ip_address?: string,
    user_agent?: string
  ): void {
    this.log({
      tenant_id,
      user_id,
      entity_type,
      entity_id,
      action: 'STATUS_CHANGE',
      old_value,
      new_value,
      ip_address,
      user_agent,
    });
  }

  /**
   * Log CANCEL action
   */
  static cancel(
    tenant_id: bigint,
    user_id: bigint,
    entity_type: string,
    entity_id: bigint,
    old_value?: any,
    new_value?: any,
    ip_address?: string,
    user_agent?: string
  ): void {
    this.log({
      tenant_id,
      user_id,
      entity_type,
      entity_id,
      action: 'CANCEL',
      old_value,
      new_value,
      ip_address,
      user_agent,
    });
  }
}
