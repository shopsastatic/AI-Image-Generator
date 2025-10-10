// historyService.ts
interface N8NHistoryItem {
  id: string;
  data: {
    url: string[];
    category: string;
    sub_category: string;
    prompt: string[];
    describe: string;
  };
  created_at: string;
}

interface HistoryImage {
  imageUrl: string;
  prompt: string;
  category: string;
  subCategory: string;
  timestamp: string;
}

interface HistorySession {
  sessionId: string;
  describe: string;
  category: string;
  subCategory: string;
  images: HistoryImage[];
  timestamp: string;
  createdAt: string;
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
  }[];
}

class HistoryService {
  private readonly apiUrl = 'https://n8n.misencorp.com/webhook/get-history';
  private cache: HistorySession[] | null = null;
  private lastCacheTime: number = 0;
  private readonly cacheDuration = 30000; // 30 seconds

  /**
   * Fetch history từ N8N API
   */
  async fetchHistory(): Promise<HistorySession[]> {
    try {
      // Kiểm tra cache
      if (this.cache && (Date.now() - this.lastCacheTime < this.cacheDuration)) {
        console.log('📦 Returning cached history data');
        return this.cache;
      }

      console.log('🔄 Fetching history from N8N API...');
      
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: N8NHistoryItem[] = await response.json();
      console.log('✅ Received history data:', data.length, 'items');

      // Transform data
      const sessions = this.transformN8NData(data);
      
      // Cache kết quả
      this.cache = sessions;
      this.lastCacheTime = Date.now();

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
    return data.map(item => {
      const images: HistoryImage[] = [];
      
      // Map URLs và prompts theo index
      const urlCount = item.data.url?.length || 0;
      const promptCount = item.data.prompt?.length || 0;
      const maxCount = Math.max(urlCount, promptCount);

      for (let i = 0; i < maxCount; i++) {
        images.push({
          imageUrl: item.data.url?.[i] || '',
          prompt: item.data.prompt?.[i] || item.data.describe || '',
          category: item.data.category || '',
          subCategory: item.data.sub_category || '',
          timestamp: item.created_at || new Date().toISOString(),
        });
      }

      return {
        sessionId: item.id,
        describe: item.data.describe || '',
        category: item.data.category || '',
        subCategory: item.data.sub_category || '',
        images: images,
        timestamp: item.created_at || new Date().toISOString(),
        createdAt: item.created_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Nhóm sessions theo ngày cho sidebar
   */
  groupByDate(sessions: HistorySession[]): HistoryDateGroup[] {
    const groups: HistoryDateGroup[] = [];
    const dateMap = new Map<string, HistoryDateGroup>();

    for (const session of sessions) {
      // Bỏ qua session không có ảnh
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

      // Lấy hoặc tạo nhóm cho ngày này
      let group = dateMap.get(date);
      if (!group) {
        group = { date, items: [] };
        dateMap.set(date, group);
        groups.push(group);
      }

      // Thêm vào nhóm
      group.items.push({
        id: session.sessionId,
        describe: session.describe || '',
        thumbnail: session.images[0]?.imageUrl || '',
        imageCount: session.images.length,
        category: session.category || '',
        subCategory: session.subCategory || '',
      });
    }

    // Sắp xếp nhóm theo ngày (mới nhất trước)
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
   * Xóa cache để force refresh
   */
  clearCache(): void {
    this.cache = null;
    this.lastCacheTime = 0;
    console.log('🗑️ History cache cleared');
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