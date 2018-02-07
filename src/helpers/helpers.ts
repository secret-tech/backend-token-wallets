import * as LRU from 'lru-cache';
import { number } from 'joi';

function escape(str: string): string {
  return str.replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function unescape(str: string): string {
  return (str + '==='.slice((str.length + 3) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
}

export function base64encode(email: string): string {
  return escape(Buffer.from(email, 'utf8').toString('base64'));
}

export function base64decode(str) {
  return Buffer.from(unescape(str), 'base64').toString('utf8');
}

export function intersect<T>(a: T[], b: T[]): T[] {
  return a.filter(ai => b.indexOf(ai) > -1);
}

export function difference<T>(a: T[], b: T[]): T[] {
  return a.filter(ai => b.indexOf(ai) < 0);
}

/**
 *
 * @param srcArray
 * @param size
 */
export function chunkArray<T>(srcArray: T[], size: number): T[][] {
  return Array.from(
    Array(Math.ceil(srcArray.length / size)),
    (_, i) => srcArray.slice(i * size, i * size + size)
  );
}

/**
 *
 * @param items
 * @param chunkSize
 * @param mapFunc
 */
export async function processAsyncIntRangeByChunks<R>(
  from: number, to: number, step: number, chunkSize: number, mapFunc: (item: number) => Promise<R>
): Promise<R[]> {
  if (from > to) {
    throw new Error('Invalid range');
  }
  let data: R[] = [];
  let numbers: number[];
  let j: number;

  while (from <= to) {
    numbers = [];
    for (j = 0; j < chunkSize && from <= to; ++j, from += step) {
      numbers.push(from);
    }
    data = data.concat(await Promise.all(numbers.map(mapFunc)));
  }

  return data;
}

/**
 *
 * @param items
 * @param chunkSize
 * @param mapFunc
 */
export async function processAsyncItemsByChunks<T, R>(
  items: T[], chunkSize: number, mapFunc: (item: T) => Promise<R>
): Promise<R[]> {
  const parts = chunkArray(items, Math.max(chunkSize, 1));
  let data: R[] = [];

  for (let i = 0; i < parts.length; i++) {
    data = data.concat(await Promise.all(parts[i].map(mapFunc)));
  }

  return data;
}

/**
 * Execute methods and cache it value by key.
 */
export class CacheMethodResult {
  private cache: LRU;

  /**
   * Init lru cache
   * @param maxCount lru cache size
   * @param ttl of cache record
   */
  constructor(maxCount: number, ttl: number) {
    this.cache = LRU({
      max: maxCount,
      maxAge: ttl
    });
  }

  /**
   * Run method or get from cache result.
   * @param key cache name
   * @param method to execute
   */
  async run<T>(key: string, method: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    return method().then(val => {
      this.cache.set(key, val);
      return val;
    });
  }
}
