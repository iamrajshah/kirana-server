import { Decimal } from '@prisma/client/runtime/library';

/**
 * Recursively converts BigInt values to strings and Decimal values to numbers in an object
 */
export function serializeBigInt<T>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  // Convert Prisma Decimal to number
  if (obj instanceof Decimal) {
    return obj.toNumber();
  }

  // Preserve Date objects
  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized;
  }

  return obj;
}
