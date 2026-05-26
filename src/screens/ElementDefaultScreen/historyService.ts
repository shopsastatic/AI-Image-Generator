// historyService.ts
interface N8NHistoryItem {
  id: string;
  data: {
    url: string[];
    category: string;
    sub_category: string;
    prompt: string[];
    describe: string;
    role?: string;
    platform?: string | string[];
  };
  created_at: string;
}

interface HistoryImage {
  imageUrl: string;
  prompt: string;
  category: string;
  subCategory: string;
  platform: string;
  timestamp: string;
}

interface HistorySession {
  sessionId: string;
  describe: string;
  category: string;
  subCategory: string;
  platform: string;
  images: HistoryImage[];
  timestamp: string;
  createdAt: string;
  role?: string;
}

interface HistoryDateGroup {
  date: string;
  items: {
    id: string;
    describe: string;
    thumbnail: string;
    imageCount: number;
    category: string;
    subCategory: string;
    platform: string;
  }[];
}

interface FetchHistoryOptions {
  forceRefresh?: boolean;
}

export interface NewHistorySessionInput {
  sessionId: string;
  describe: string;
  category: string;
  subCategory: string;
  platform: string;
  role?: string;
  images: HistoryImage[];
}

const STORAGE_PREFIX = 'history_cache_v1_';
const MEMORY_CACHE_TTL = 30_000;
const STORAGE_CACHE_TTL = 24 * 60 * 60 * 1000;

class HistoryService {
  private readonly apiUrl = '/api/history';
  private cacheMap: Map<string, { data: HistorySession[]; timestamp: number }> = new Map();

  private getCacheKey(roleFilters?: string[]): string {
    return roleFilters?.length ? roleFilters.slice().sort().join(',') : 'none';
  }

  private readStorageCache(cacheKey: string): { data: HistorySession[]; timestamp: number } | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${cacheKey}`);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as { data: HistorySession[]; timestamp: number };
      if (!parsed?.data || Date.now() - parsed.timestamp > STORAGE_CACHE_TTL) {
        localStorage.removeItem(`${STORAGE_PREFIX}${cacheKey}`);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private writeStorageCache(cacheKey: string, data: HistorySession[]): void {
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${cacheKey}`,
        JSON.stringify({ data, timestamp: Date.now() })
      );
    } catch {
      // Ignore quota errors
    }
  }

  private getAllCacheKeys(): Set<string> {
    const keys = new Set<string>(['none']);
    this.cacheMap.forEach((_, key) => keys.add(key));
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => keys.add(k.slice(STORAGE_PREFIX.length)));
    return keys;
  }

  private shouldIncludeSessionForCache(
    sessionRole: string,
    roleFilters?: string[]
  ): boolean {
    if (!roleFilters?.length) return true;
    return Boolean(sessionRole && roleFilters.includes(sessionRole));
  }

  private prependToCache(
    cacheKey: string,
    roleFilters: string[] | undefined,
    session: HistorySession
  ): void {
    const sessionRole = session.role?.trim() || '';
    if (!this.shouldIncludeSessionForCache(sessionRole, roleFilters)) return;

    const existing =
      cacheKey === 'none'
        ? this.getCachedHistory(undefined)
        : this.getCachedHistory(roleFilters);

    if (existing.some(s => s.sessionId === session.sessionId)) return;

    const updated = [session, ...existing];
    this.cacheMap.set(cacheKey, { data: updated, timestamp: Date.now() });
    this.writeStorageCache(cacheKey, updated);
  }

  /**
   * Add a newly generated session to local cache immediately (before server sync).
   */
  addLocalSession(session: HistorySession): void {
    for (const cacheKey of this.getAllCacheKeys()) {
      const roleFilters =
        cacheKey === 'none' ? undefined : cacheKey.split(',');
      this.prependToCache(cacheKey, roleFilters, session);
    }

    window.dispatchEvent(new CustomEvent('history:updated'));
  }

  /**
   * Call after image generation completes — optimistic update + background server sync.
   */
  onGenerationComplete(input: NewHistorySessionInput): void {
    const now = new Date().toISOString();
    this.addLocalSession({
      ...input,
      timestamp: now,
      createdAt: now,
    });
    void this.syncAfterGeneration();
  }

  private async syncAfterGeneration(): Promise<void> {
    const delays = [2000, 3000];

    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      try {
        await this.fetchHistory(undefined, { forceRefresh: true });
        window.dispatchEvent(new CustomEvent('history:updated'));
        return;
      } catch {
        // Retry after next delay
      }
    }
  }

  /**
   * Returns cached data synchronously for instant UI render (memory → localStorage).
   */
  getCachedHistory(roleFilters?: string[]): HistorySession[] {
    const cacheKey = this.getCacheKey(roleFilters);
    const memory = this.cacheMap.get(cacheKey);
    if (memory) return memory.data;

    const storage = this.readStorageCache(cacheKey);
    if (storage) {
      this.cacheMap.set(cacheKey, storage);
      return storage.data;
    }

    return [];
  }

  /**
   * Prefetch history in background (e.g. on app load).
   */
  prefetch(roleFilters?: string[]): void {
    void this.fetchHistory(roleFilters).catch(() => {});
  }

  async fetchHistory(
    roleFilters?: string[],
    options: FetchHistoryOptions = {}
  ): Promise<HistorySession[]> {
    const cacheKey = this.getCacheKey(roleFilters);
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = this.cacheMap.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        return cached.data;
      }
    }

    const url = new URL(this.apiUrl, window.location.origin);
    if (roleFilters && roleFilters.length > 0) {
      url.searchParams.append('roleFilter', roleFilters.join(','));
    }
    if (forceRefresh) {
      url.searchParams.append('refresh', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: N8NHistoryItem[] = await response.json();
    let sessions = this.transformN8NData(data);

    if (forceRefresh) {
      const previous = this.getCachedHistory(roleFilters);
      const serverIds = new Set(sessions.map(s => s.sessionId));
      const pendingLocal = previous.filter(s => !serverIds.has(s.sessionId));
      if (pendingLocal.length > 0) {
        sessions = [...pendingLocal, ...sessions].sort((a, b) => {
          const timeA = new Date(a.timestamp || a.createdAt).getTime();
          const timeB = new Date(b.timestamp || b.createdAt).getTime();
          return timeB - timeA;
        });
      }
    }

    const entry = { data: sessions, timestamp: Date.now() };
    this.cacheMap.set(cacheKey, entry);
    this.writeStorageCache(cacheKey, sessions);

    return sessions;
  }

  private transformN8NData(data: N8NHistoryItem[]): HistorySession[] {
    const sessions = data.map(item => {
      const images: HistoryImage[] = [];
      const urlCount = item.data.url?.length || 0;
      const promptCount = item.data.prompt?.length || 0;
      const maxCount = Math.max(urlCount, promptCount);

      for (let i = 0; i < maxCount; i++) {
        const platformValue = Array.isArray(item.data.platform)
          ? (item.data.platform[i] || '')
          : (item.data.platform || '');

        images.push({
          imageUrl: item.data.url?.[i] || '',
          prompt: item.data.prompt?.[i] || item.data.describe || '',
          category: item.data.category || '',
          subCategory: item.data.sub_category || '',
          platform: platformValue,
          timestamp: item.created_at || new Date().toISOString(),
        });
      }

      return {
        sessionId: item.id,
        describe: item.data.describe || '',
        category: item.data.category || '',
        subCategory: item.data.sub_category || '',
        platform: Array.isArray(item.data.platform)
          ? (item.data.platform[0] || '')
          : (item.data.platform || ''),
        role: item.data.role ?? (item as N8NHistoryItem & { role?: string }).role,
        images,
        timestamp: item.created_at || new Date().toISOString(),
        createdAt: item.created_at || new Date().toISOString(),
      };
    });

    return sessions.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt).getTime();
      const timeB = new Date(b.timestamp || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  groupByDate(sessions: HistorySession[]): HistoryDateGroup[] {
    const groups: HistoryDateGroup[] = [];
    const dateMap = new Map<string, HistoryDateGroup>();

    for (const session of sessions) {
      if (!session.images || session.images.length === 0) continue;

      const timestamp = session.timestamp || session.createdAt;
      const date = timestamp
        ? new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Unknown Date';

      let group = dateMap.get(date);
      if (!group) {
        group = { date, items: [] };
        dateMap.set(date, group);
        groups.push(group);
      }

      group.items.push({
        id: session.sessionId,
        describe: session.describe || '',
        thumbnail: session.images[0]?.imageUrl || '',
        imageCount: session.images.length,
        category: session.category || '',
        subCategory: session.subCategory || '',
        platform: session.platform || '',
      });
    }

    groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return groups;
  }

  async getSessionById(sessionId: string, roleFilters?: string[]): Promise<HistorySession | null> {
    const cached = this.getCachedHistory(roleFilters);
    const fromCache = cached.find(s => s.sessionId === sessionId);
    if (fromCache) return fromCache;

    try {
      const sessions = await this.fetchHistory(roleFilters);
      return sessions.find(s => s.sessionId === sessionId) || null;
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        this.clearCache();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  clearCache(roleFilter?: string): void {
    if (roleFilter) {
      const key = this.getCacheKey([roleFilter]);
      this.cacheMap.delete(key);
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } else {
      this.cacheMap.clear();
      Object.keys(localStorage)
        .filter(k => k.startsWith(STORAGE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    }
  }

  static formatCategoryTag(category: string, subCategory: string): string {
    if (!category) return '';
    if (!subCategory) return category;
    return `${category}/${subCategory}`;
  }
}

export const historyService = new HistoryService();
export type { HistorySession, HistoryImage, HistoryDateGroup };
