import type { CacheService } from "./types";

/**
 * Cloudflare KV 快取服務實作
 */
export class KVCacheService implements CacheService {
  constructor(private readonly kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key, "json");
      if (value) {
        console.log(`[Cache Hit] ${key}`);
      } else {
        console.log(`[Cache Miss] ${key}`);
      }
      return value as T | null;
    } catch (error) {
      console.error(`[Cache Error] Failed to get ${key}:`, error);
      return null; // 快取錯誤不應中斷主流程
    }
  }

  async set<T>(key: string, value: T, ttl = 3600): Promise<void> {
    try {
      await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
      console.log(`[Cache Set] ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`[Cache Error] Failed to set ${key}:`, error);
      // 不拋出錯誤,快取失敗不應中斷主流程
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
      console.log(`[Cache Delete] ${key}`);
    } catch (error) {
      console.error(`[Cache Error] Failed to delete ${key}:`, error);
    }
  }

  async deleteMultiple(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((k) => this.kv.delete(k)));
      console.log(`[Cache Delete Multiple] ${keys.length} keys deleted`);
    } catch (error) {
      console.error("[Cache Error] Failed to delete multiple keys:", error);
    }
  }

  async invalidateUser(userId: string): Promise<void> {
    const keys = [
      `user:${userId}:conversations:list`,
      `user:${userId}:opportunities:list`,
      `user:${userId}:analytics:dashboard`,
      `user:${userId}:analytics:repPerformance`,
    ];
    await this.deleteMultiple(keys);
    console.log(`[Cache Invalidate] Cleared all caches for user ${userId}`);
  }
}

export function createKVCacheService(kv: KVNamespace): KVCacheService {
  return new KVCacheService(kv);
}
