// historyService.ts
interface N8NHistoryItem {
  id: string;
  data: {
    url: string[];
    category: string;
    sub_category: string;
    prompt: string[];
    describe: string;
    role?: string; // ✅ THÊM role
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
  role?: string; // ✅ THÊM role
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

class HistoryService {
  // ✅ THAY ĐỔI: Đổi sang backend endpoint thay vì N8N trực tiếp
  private readonly apiUrl = '/api/history';
  
  // ✅ THAY ĐỔI: Cache theo role
  private cacheMap: Map<string, { data: HistorySession[]; timestamp: number }> = new Map();
  private readonly cacheDuration = 30000; // 30 seconds

  /**
 * ✅ SỬA: Hỗ trợ multi-role filter
 */
async fetchHistory(roleFilters?: string[]): Promise<HistorySession[]> {
  try {
    // ✅ Cache key dựa trên roleFilters
    const cacheKey = roleFilters?.length ? roleFilters.sort().join(',') : 'none';
    const cached = this.cacheMap.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
      console.log(`📦 Returning cached history data for roles: ${cacheKey}`);
      return cached.data;
    }

    // ✅ Build URL với query parameters
    const url = new URL(this.apiUrl, window.location.origin);
    if (roleFilters && roleFilters.length > 0) {
      url.searchParams.append('roleFilter', roleFilters.join(','));
    }

    console.log(`🔄 Fetching history from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: N8NHistoryItem[] = await response.json();
    console.log('✅ Received history data:', data.length, 'items');

    // Transform data
    const sessions = this.transformN8NData(data);
    
    // Cache theo roles
    this.cacheMap.set(cacheKey, {
      data: sessions,
      timestamp: Date.now()
    });

    return sessions;
  } catch (error) {
    console.error('❌ Failed to fetch history:', error);
    throw error;
  }
}

  /**
   * Transform N8N data sang format component cần
   */
  private transformN8NData(data: N8NHistoryItem[]): HistorySession[] {
    const sessions = data.map(item => {
      const images: HistoryImage[] = [];
      
      const urlCount = item.data.url?.length || 0;
      const promptCount = item.data.prompt?.length || 0;
      const maxCount = Math.max(urlCount, promptCount);

      for (let i = 0; i < maxCount; i++) {
        images.push({
          imageUrl: item.data.url?.[i] || '',
          prompt: item.data.prompt?.[i] || item.data.describe || '',
          category: item.data.category || '',
          subCategory: item.data.sub_category || '',
          platform: item.data.platform || '',
          timestamp: item.created_at || new Date().toISOString(),
        });
      }

      return {
        sessionId: item.id,
        describe: item.data.describe || '',
        category: item.data.category || '',
        subCategory: item.data.sub_category || '',
        platform: item.data.platform || '',
        role: item.data.role, // ✅ THÊM role
        images: images,
        timestamp: item.created_at || new Date().toISOString(),
        createdAt: item.created_at || new Date().toISOString(),
      };
    });

    // Sắp xếp theo thời gian mới nhất trước
    return sessions.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt).getTime();
      const timeB = new Date(b.timestamp || b.createdAt).getTime();
      return timeB - timeA;
    });
  }

  /**
   * Nhóm sessions theo ngày cho sidebar
   */
  groupByDate(sessions: HistorySession[]): HistoryDateGroup[] {
    const groups: HistoryDateGroup[] = [];
    const dateMap = new Map<string, HistoryDateGroup>();

    for (const session of sessions) {
      if (!session.images || session.images.length === 0) {
        continue;
      }

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

    groups.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return groups;
  }

  /**
   * Lấy session cụ thể theo ID
   */
  async getSessionById(sessionId: string): Promise<HistorySession | null> {
    try {
      const sessions = await this.fetchHistory();
      return sessions.find(s => s.sessionId === sessionId) || null;
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      return null;
    }
  }

  /**
   * ✅ SỬA: Xóa cache theo role hoặc tất cả
   */
  clearCache(roleFilter?: string): void {
    if (roleFilter) {
      this.cacheMap.delete(roleFilter);
      console.log(`🗑️ History cache cleared for role: ${roleFilter}`);
    } else {
      this.cacheMap.clear();
      console.log('🗑️ All history cache cleared');
    }
  }

  /**
   * Format category tag
   */
  static formatCategoryTag(category: string, subCategory: string): string {
    if (!category) return '';
    if (!subCategory) return category;
    return `${category}/${subCategory}`;
  }
}

// Export singleton instance
export const historyService = new HistoryService();
export type { HistorySession, HistoryImage, HistoryDateGroup };