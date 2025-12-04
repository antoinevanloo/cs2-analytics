/**
 * Performance Utilities - Optimization helpers for calculations
 *
 * Provides:
 * - Memoization for expensive calculations
 * - Batch processing for large datasets
 * - Single-pass aggregation utilities
 * - Lazy evaluation helpers
 *
 * @module analysis/utils/performance
 */

/**
 * Simple memoization cache with TTL
 */
export class MemoCache<K, V> {
  private cache = new Map<string, { value: V; expires: number }>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(options: { ttlMs?: number; maxSize?: number } = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 1000;
  }

  /**
   * Get cached value or compute and cache
   */
  getOrCompute(key: K, compute: () => V): V {
    const keyStr = this.serializeKey(key);
    const now = Date.now();

    // Check cache
    const cached = this.cache.get(keyStr);
    if (cached && cached.expires > now) {
      return cached.value;
    }

    // Compute new value
    const value = compute();

    // Evict if at capacity (LRU-style: just delete oldest)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Cache result
    this.cache.set(keyStr, {
      value,
      expires: now + this.ttlMs,
    });

    return value;
  }

  /**
   * Clear expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  private serializeKey(key: K): string {
    return JSON.stringify(key);
  }
}

/**
 * Create a memoized version of a function
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options: {
    ttlMs?: number;
    maxSize?: number;
    keyFn?: (...args: TArgs) => string;
  } = {},
): (...args: TArgs) => TResult {
  const cache = new MemoCache<string, TResult>(options);
  const keyFn = options.keyFn ?? ((...args) => JSON.stringify(args));

  return (...args: TArgs): TResult => {
    const key = keyFn(...args);
    return cache.getOrCompute(key, () => fn(...args));
  };
}

/**
 * Single-pass aggregator for computing multiple stats in one iteration
 *
 * Instead of iterating multiple times for sum, avg, min, max,
 * compute everything in a single pass.
 */
export class SinglePassAggregator<T> {
  private count = 0;
  private sum = 0;
  private min = Infinity;
  private max = -Infinity;
  private sumSquares = 0; // For variance/stddev
  private values: number[] = [];

  constructor(
    private readonly extractor: (item: T) => number,
    private readonly collectValues: boolean = false,
  ) {}

  /**
   * Process a single item
   */
  add(item: T): void {
    const value = this.extractor(item);

    if (isNaN(value)) return;

    this.count++;
    this.sum += value;
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);
    this.sumSquares += value * value;

    if (this.collectValues) {
      this.values.push(value);
    }
  }

  /**
   * Process multiple items
   */
  addAll(items: readonly T[]): void {
    for (const item of items) {
      this.add(item);
    }
  }

  /**
   * Get aggregation results
   */
  result(): AggregationResult {
    if (this.count === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        variance: 0,
        stdDev: 0,
        median: null,
      };
    }

    const avg = this.sum / this.count;
    const variance = this.sumSquares / this.count - avg * avg;
    const stdDev = Math.sqrt(Math.max(0, variance));

    let median: number | null = null;
    if (this.collectValues && this.values.length > 0) {
      const sorted = [...this.values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      median =
        sorted.length % 2 === 0
          ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
          : (sorted[mid] ?? 0);
    }

    return {
      count: this.count,
      sum: this.sum,
      avg,
      min: this.min === Infinity ? 0 : this.min,
      max: this.max === -Infinity ? 0 : this.max,
      variance,
      stdDev,
      median,
    };
  }
}

export interface AggregationResult {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  variance: number;
  stdDev: number;
  median: number | null;
}

/**
 * Process items in batches with progress callback
 */
export async function processBatch<T, R>(
  items: readonly T[],
  processor: (item: T, index: number) => R | Promise<R>,
  options: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
    onBatchComplete?: (results: R[], batchIndex: number) => void;
  } = {},
): Promise<R[]> {
  const { batchSize = 100, onProgress, onBatchComplete } = options;
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults: R[] = [];

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      if (item !== undefined) {
        const result = await processor(item, i + j);
        batchResults.push(result);
      }
    }

    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }

    if (onBatchComplete) {
      onBatchComplete(batchResults, Math.floor(i / batchSize));
    }

    // Yield to event loop between batches
    await new Promise((resolve) => setImmediate(resolve));
  }

  return results;
}

/**
 * Group items by a key in a single pass
 */
export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return groups;
}

/**
 * Index items by a key for O(1) lookup
 */
export function indexBy<T, K extends string | number>(
  items: readonly T[],
  keyFn: (item: T) => K,
): Map<K, T> {
  const index = new Map<K, T>();

  for (const item of items) {
    index.set(keyFn(item), item);
  }

  return index;
}

/**
 * Multi-pass optimization: collect all needed data in one iteration
 */
export interface MultiPassCollector<T> {
  add(item: T): void;
}

export function createMultiCollector<T>(
  collectors: MultiPassCollector<T>[],
): (items: readonly T[]) => void {
  return (items: readonly T[]) => {
    for (const item of items) {
      for (const collector of collectors) {
        collector.add(item);
      }
    }
  };
}

/**
 * Lazy evaluation wrapper
 */
export class Lazy<T> {
  private computed = false;
  private value: T | undefined;

  constructor(private readonly factory: () => T) {}

  get(): T {
    if (!this.computed) {
      this.value = this.factory();
      this.computed = true;
    }
    return this.value!;
  }

  isComputed(): boolean {
    return this.computed;
  }

  reset(): void {
    this.computed = false;
    this.value = undefined;
  }
}

/**
 * Create a lazy value
 */
export function lazy<T>(factory: () => T): Lazy<T> {
  return new Lazy(factory);
}
