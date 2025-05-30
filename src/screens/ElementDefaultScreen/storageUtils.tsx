/**
 * storageUtils.ts - Phiên bản hoàn toàn mới
 * 
 * Quản lý lưu trữ và truy xuất dữ liệu phiên ảnh với cơ chế xử lý lỗi mạnh mẽ
 */

// Định nghĩa các interface để type safety
interface ImageData {
  imageUrl: string;
  prompt: string;
  timestamp: string;
  size?: string;
  quality?: string;
  claudeResponse?: string;
  AdCreativeA?: string;
  AdCreativeB?: string;
  targeting?: string;
  imageName?: string;
  isBlob?: boolean;
  originalBase64?: string;
}

interface SessionData {
  sessionId: string;
  describe?: string;
  images: ImageData[];
  timestamp?: string;
  createdAt?: string;
}

interface HistoryGroup {
  date: string;
  items: HistoryItem[];
}

interface HistoryItem {
  id: string;
  describe: string;
  thumbnail: string;
  imageCount: number;
}

// Lớp quản lý lưu trữ chính
class StorageManager {
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;
  private readonly dbName: string = 'AIImageGenerator';
  private readonly dbVersion: number = 2; // Tăng version để cập nhật schema
  private pendingSaves: Map<string, any> = new Map();
  private sessionsCache: any[] | null = null;
  private lastCacheTime: number = 0;
  private operationLock: boolean = false;
  private operationQueue: Array<() => Promise<void>> = [];
  private readonly DEBUG: boolean = true; // Bật/tắt log debug

  // Constructor
  constructor() {
    this.logDebug('StorageManager được khởi tạo');
  }

  /**
   * Khởi tạo kết nối đến IndexedDB
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logDebug('Đang khởi tạo storage...');
      
      return new Promise((resolve, reject) => {
        // Kiểm tra hỗ trợ IndexedDB
        if (!window.indexedDB) {
          this.logDebug('IndexedDB không được hỗ trợ, dùng localStorage');
          this.isInitialized = true;
          resolve();
          return;
        }

        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = (event) => {
          console.error('❌ Lỗi IndexedDB:', event);
          this.isInitialized = true;
          resolve(); // Vẫn resolve để dùng localStorage fallback
        };

        request.onsuccess = (event: any) => {
          this.db = event.target.result;
          this.isInitialized = true;
          
          // Thiết lập error handler
          this.db.onerror = (event: any) => {
            console.error('❌ Lỗi database:', event.target.errorCode);
          };
          
          this.logDebug('✅ IndexedDB khởi tạo thành công');
          
          // Thực hiện deduplicate khi khởi động
          this.deduplicateOnStartup().then(() => {
            resolve();
          }).catch(err => {
            console.warn('⚠️ Lỗi khi deduplicate:', err);
            resolve(); // Vẫn resolve dù có lỗi
          });
        };

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          
          // Xóa object store cũ nếu tồn tại và tạo mới
          if (db.objectStoreNames.contains('sessions')) {
            db.deleteObjectStore('sessions');
          }
          
          // Tạo object store mới với các indexes cần thiết
          const store = db.createObjectStore('sessions', { keyPath: 'sessionId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          this.logDebug('📦 Đã tạo/nâng cấp object store sessions');
        };
      });
    } catch (error) {
      console.error('❌ Lỗi khởi tạo StorageManager:', error);
      this.isInitialized = true; // Vẫn đánh dấu đã khởi tạo để dùng localStorage
    }
  }

  /**
   * Lưu một session mới hoặc cập nhật session hiện có
   */
  async saveSession(sessionData: SessionData): Promise<string> {
    await this.waitForInit();
    
    try {
      // Đảm bảo có sessionId
      if (!sessionData.sessionId) {
        throw new Error('Session ID là bắt buộc');
      }

      this.logDebug(`🔄 Đang lưu session: ${sessionData.sessionId}`);

      // Đợi các thao tác khác hoàn thành
      await this.waitForLock();
      this.operationLock = true;

      try {
        // Kiểm tra session đã tồn tại chưa
        const existingSessions = await this.getAllSessionsInternal();
        const existingSession = existingSessions.find(
          session => session.sessionId === sessionData.sessionId
        );
        
        // Chuẩn bị dữ liệu session
        const now = new Date().toISOString();
        const session = {
          sessionId: sessionData.sessionId,
          describe: sessionData.describe || '',
          createdAt: existingSession?.createdAt || now,
          timestamp: now,
          images: []
        };
        
        // Xử lý và chuẩn hóa images
        if (sessionData.images && sessionData.images.length > 0) {
          for (const image of sessionData.images) {
            // Đảm bảo có đủ dữ liệu cho mỗi ảnh
            const imageData: ImageData = {
              imageUrl: image.imageBase64 || image.imageUrl || '',
              prompt: image.prompt || '',
              timestamp: image.timestamp || now,
              size: image.size || 'Square',
              quality: image.quality || 'Standard'
            };
            
            // Thêm các trường tùy chọn nếu có
            if (image.claudeResponse) imageData.claudeResponse = image.claudeResponse;
            if (image.AdCreativeA) imageData.AdCreativeA = image.AdCreativeA;
            if (image.AdCreativeB) imageData.AdCreativeB = image.AdCreativeB;
            if (image.targeting) imageData.targeting = image.targeting;
            if (image.imageName) imageData.imageName = image.imageName;
            
            // Bỏ qua ảnh rỗng hoặc ảnh placeholder
            if (!imageData.imageUrl || 
                imageData.imageUrl.includes('PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM') ||
                imageData.imageUrl === 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg==') {
              this.logDebug(`⚠️ Bỏ qua ảnh rỗng hoặc placeholder`);
              continue;
            }
            
            session.images.push(imageData);
          }
        }

        // Kiểm tra nếu không có ảnh nào hợp lệ
        if (session.images.length === 0) {
          this.logDebug(`⚠️ Không có ảnh hợp lệ trong session ${sessionData.sessionId}, bỏ qua`);
          return sessionData.sessionId;
        }
        
        // Lưu vào IndexedDB hoặc localStorage
        if (this.db) {
          const tx = this.db.transaction('sessions', 'readwrite');
          const store = tx.objectStore('sessions');
          
          await new Promise<void>((resolve, reject) => {
            let request;
            if (existingSession) {
              request = store.put(session);
            } else {
              request = store.add(session);
            }
            
            request.onsuccess = () => resolve();
            request.onerror = (e: any) => reject(e.target.error);
            tx.oncomplete = () => resolve();
            tx.onerror = (e: any) => reject(e.target.error);
          });
        } else {
          // Fallback to localStorage
          if (existingSession) {
            const index = existingSessions.findIndex(s => s.sessionId === sessionData.sessionId);
            if (index !== -1) {
              existingSessions[index] = session;
            } else {
              existingSessions.push(session);
            }
          } else {
            existingSessions.push(session);
          }
          
          localStorage.setItem('Image_Generator_Sessions', JSON.stringify(existingSessions));
        }

        // Xóa cache để buộc refresh khi đọc lại
        this.sessionsCache = null;
        
        this.logDebug(`✅ Session ${sessionData.sessionId} lưu thành công với ${session.images.length} ảnh`);
        return sessionData.sessionId;
      } finally {
        // Giải phóng lock
        this.operationLock = false;
        this.processQueue();
      }
    } catch (error) {
      console.error('❌ Lỗi lưu session:', error);
      this.operationLock = false;
      this.processQueue();
      throw error;
    }
  }

  /**
   * Lấy tất cả sessions (đã deduplicate)
   */
  async getAllSessions(): Promise<any[]> {
    await this.waitForInit();
    
    try {
      // Đợi thao tác khác hoàn thành
      await this.waitForLock();
      this.operationLock = true;
      
      try {
        const sessions = await this.getAllSessionsInternal();
        return sessions;
      } finally {
        this.operationLock = false;
        this.processQueue();
      }
    } catch (error) {
      console.error('❌ Lỗi lấy sessions:', error);
      this.operationLock = false;
      this.processQueue();
      return [];
    }
  }

  /**
   * Helper nội bộ để lấy tất cả sessions
   */
  private async getAllSessionsInternal(): Promise<any[]> {
    try {
      // Trả về cache nếu còn mới (dưới 2 giây)
      if (this.sessionsCache && (Date.now() - this.lastCacheTime < 2000)) {
        return this.sessionsCache;
      }

      let sessions = [];

      if (this.db) {
        const tx = this.db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        
        // Lấy tất cả sessions từ IndexedDB
        sessions = await new Promise<any[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = (e: any) => reject(e.target.error);
        });
      } else {
        // Fallback to localStorage
        try {
          const sessionsJson = localStorage.getItem('Image_Generator_Sessions');
          if (sessionsJson) {
            sessions = JSON.parse(sessionsJson);
          }
        } catch (parseError) {
          console.error('❌ Lỗi parse sessions từ localStorage:', parseError);
        }
      }

      // Deduplicate và validate sessions
      const validatedSessions = this.validateAndDeduplicateSessions(sessions);
      
      // Cache kết quả
      this.sessionsCache = validatedSessions;
      this.lastCacheTime = Date.now();

      return validatedSessions;
    } catch (error) {
      console.error('❌ Lỗi lấy sessions nội bộ:', error);
      return [];
    }
  }

  /**
   * Xác thực và loại bỏ trùng lặp trong danh sách sessions
   */
  private validateAndDeduplicateSessions(sessions: any[]): any[] {
    if (!Array.isArray(sessions)) {
      this.logDebug('⚠️ Sessions không phải array, trả về array rỗng');
      return [];
    }
    
    // Lọc bỏ sessions không hợp lệ và trùng lặp
    const sessionMap = new Map();
    const validSessions = [];
    
    for (const session of sessions) {
      // Kiểm tra session có hợp lệ không
      if (!session || !session.sessionId || !session.images) {
        continue;
      }
      
      // Lọc bỏ các ảnh không hợp lệ
      const validImages = (session.images || []).filter((img: any) => {
        return img && img.imageUrl && 
               !img.imageUrl.includes('PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM') &&
               img.imageUrl !== 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg==';
      });
      
      // Bỏ qua session không có ảnh hợp lệ
      if (validImages.length === 0) {
        continue;
      }
      
      // Tạo bản sao để cập nhật
      const updatedSession = {
        ...session,
        images: validImages
      };
      
      // Kiểm tra trùng lặp bằng sessionId
      const existingSession = sessionMap.get(session.sessionId);
      
      if (existingSession) {
        // Nếu session này mới hơn, thay thế session cũ
        const existingTime = new Date(existingSession.timestamp || existingSession.createdAt || 0).getTime();
        const currentTime = new Date(session.timestamp || session.createdAt || 0).getTime();
        
        if (currentTime > existingTime) {
          sessionMap.set(session.sessionId, updatedSession);
        }
      } else {
        // Nếu chưa có, thêm vào map
        sessionMap.set(session.sessionId, updatedSession);
      }
    }
    
    // Chuyển đổi Map thành array
    for (const session of sessionMap.values()) {
      validSessions.push(session);
    }
    
    // Sắp xếp theo thời gian (mới nhất trước)
    validSessions.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    
    // Cập nhật localStorage nếu cần thiết
    if (!this.db && validSessions.length !== sessions.length) {
      this.logDebug(`📝 Cập nhật localStorage với ${validSessions.length} sessions hợp lệ từ ${sessions.length} sessions gốc`);
      localStorage.setItem('Image_Generator_Sessions', JSON.stringify(validSessions));
    }
    
    return validSessions;
  }

  /**
   * Lấy dữ liệu lịch sử cho sidebar
   */
  /**
   * Lấy dữ liệu lịch sử cho sidebar
   */
  async getHistoryForSidebar(): Promise<HistoryGroup[]> {
    await this.waitForInit();
    
    try {
      const sessions = await this.getAllSessions();
      
      if (!sessions || sessions.length === 0) {
        return [];
      }

      // Nhóm theo ngày
      const groupedByDate = this.groupSessionsByDate(sessions);
      return groupedByDate;
    } catch (error) {
      console.error('❌ Lỗi lấy history cho sidebar:', error);
      return [];
    }
  }

  /**
   * Nhóm sessions theo ngày
   */
  private groupSessionsByDate(sessions: any[]): HistoryGroup[] {
    const groups: HistoryGroup[] = [];
    const dateMap = new Map<string, HistoryGroup>();
    
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
            year: 'numeric' 
          })
        : 'Unknown Date';

      // Lấy hoặc tạo nhóm cho ngày này
      let group = dateMap.get(date);
      if (!group) {
        group = { date, items: [] };
        dateMap.set(date, group);
        groups.push(group);
      }

      // Tìm ảnh đầu tiên làm thumbnail
      const firstImage = session.images[0];
      const thumbnailImage = firstImage?.imageUrl || '';
      
      // Thêm vào nhóm - Không cần chuyển đổi thành blob URL ở đây
      // Việc chuyển đổi sẽ được thực hiện trong component SafeHistoryImage
      group.items.push({
        id: session.sessionId,
        describe: session.describe || '',
        thumbnail: thumbnailImage,
        imageCount: session.images.length
      });
    }

    // Sắp xếp nhóm theo ngày (mới nhất trước)
    groups.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    // Sắp xếp items trong mỗi nhóm (mới nhất trước)
    groups.forEach(group => {
      group.items.sort((a, b) => {
        // Mặc định có thể so sánh theo ID vì chúng chứa timestamp
        return b.id.localeCompare(a.id);
      });
    });

    return groups;
  }

  /**
   * Nhóm sessions theo ngày
   */
  private groupSessionsByDate(sessions: any[]): HistoryGroup[] {
    const groups: HistoryGroup[] = [];
    const dateMap = new Map<string, HistoryGroup>();
    
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
            year: 'numeric' 
          })
        : 'Unknown Date';

      // Lấy hoặc tạo nhóm cho ngày này
      let group = dateMap.get(date);
      if (!group) {
        group = { date, items: [] };
        dateMap.set(date, group);
        groups.push(group);
      }

      // Tìm ảnh đầu tiên làm thumbnail
      const firstImage = session.images[0];
      const thumbnailImage = firstImage?.imageUrl || '';
      
      // Thêm vào nhóm
      group.items.push({
        id: session.sessionId,
        describe: session.describe || '',
        thumbnail: thumbnailImage,
        imageCount: session.images.length
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
   * Lấy ảnh cho một session cụ thể
   */
  async getSessionImages(sessionId: string): Promise<ImageData[]> {
    await this.waitForInit();
    
    try {
      const sessions = await this.getAllSessions();
      const session = sessions.find(s => s.sessionId === sessionId);

      if (!session || !session.images || session.images.length === 0) {
        return [];
      }

      // Lọc bỏ ảnh không hợp lệ
      const validImages = session.images.filter((img: ImageData) => {
        return img && img.imageUrl && 
               !img.imageUrl.includes('PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM') &&
               img.imageUrl !== 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg==';
      });
      
      if (validImages.length === 0) {
        this.logDebug(`⚠️ Không tìm thấy ảnh hợp lệ cho session: ${sessionId}`);
      } else {
        this.logDebug(`✅ Đã tìm thấy ${validImages.length} ảnh hợp lệ cho session: ${sessionId}`);
      }
      
      return validImages;
    } catch (error) {
      console.error(`❌ Lỗi lấy ảnh cho session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Xóa một session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    await this.waitForInit();
    
    try {
      // Đợi thao tác khác hoàn thành
      await this.waitForLock();
      this.operationLock = true;
      
      try {
        if (this.db) {
          const tx = this.db.transaction('sessions', 'readwrite');
          const store = tx.objectStore('sessions');
          
          await new Promise<void>((resolve, reject) => {
            const request = store.delete(sessionId);
            request.onsuccess = () => resolve();
            request.onerror = (e: any) => reject(e.target.error);
          });
        } else {
          // Xóa từ localStorage
          const sessions = await this.getAllSessionsInternal();
          const filteredSessions = sessions.filter(s => s.sessionId !== sessionId);
          localStorage.setItem('Image_Generator_Sessions', JSON.stringify(filteredSessions));
        }

        // Xóa cache
        this.sessionsCache = null;
        
        this.logDebug(`✅ Đã xóa session: ${sessionId}`);
        return true;
      } finally {
        this.operationLock = false;
        this.processQueue();
      }
    } catch (error) {
      console.error(`❌ Lỗi xóa session ${sessionId}:`, error);
      this.operationLock = false;
      this.processQueue();
      return false;
    }
  }

  /**
   * Xóa tất cả sessions
   */
  async clearAllSessions(): Promise<boolean> {
    await this.waitForInit();
    
    try {
      // Đợi thao tác khác hoàn thành
      await this.waitForLock();
      this.operationLock = true;
      
      try {
        if (this.db) {
          const tx = this.db.transaction('sessions', 'readwrite');
          const store = tx.objectStore('sessions');
          
          await new Promise<void>((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e: any) => reject(e.target.error);
          });
        } else {
          // Xóa từ localStorage
          localStorage.removeItem('Image_Generator_Sessions');
          localStorage.removeItem('Image_Generator_Sessions_BACKUP');
        }

        // Xóa cache
        this.sessionsCache = null;
        
        this.logDebug(`✅ Đã xóa tất cả sessions`);
        return true;
      } finally {
        this.operationLock = false;
        this.processQueue();
      }
    } catch (error) {
      console.error(`❌ Lỗi xóa tất cả sessions:`, error);
      this.operationLock = false;
      this.processQueue();
      return false;
    }
  }

  /**
   * Thực hiện deduplicate khi khởi động
   */
  private async deduplicateOnStartup(): Promise<void> {
    try {
      this.logDebug('🧹 Kiểm tra và deduplicate dữ liệu khi khởi động...');
      
      let sessions: any[] = [];
      let isDirty = false;
      
      if (this.db) {
        const tx = this.db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        
        sessions = await new Promise<any[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = (e: any) => reject(e.target.error);
        });
      } else {
        try {
          const sessionsJson = localStorage.getItem('Image_Generator_Sessions');
          if (sessionsJson) {
            sessions = JSON.parse(sessionsJson);
          }
        } catch (parseError) {
          console.error('❌ Lỗi parse sessions từ localStorage:', parseError);
        }
      }
      
      if (!Array.isArray(sessions) || sessions.length === 0) {
        return;
      }
      
      // Đếm số session trước khi deduplicate
      const originalCount = sessions.length;
      
      // Lọc sessions không hợp lệ và trùng lặp
      const sessionMap = new Map();
      let invalidCount = 0;
      
      for (const session of sessions) {
        // Kiểm tra session có hợp lệ không
        if (!session || !session.sessionId) {
          invalidCount++;
          isDirty = true;
          continue;
        }
        
        // Lọc bỏ các ảnh không hợp lệ
        if (session.images && Array.isArray(session.images)) {
          const originalImageCount = session.images.length;
          
          session.images = session.images.filter((img: any) => {
            return img && img.imageUrl && 
                  !img.imageUrl.includes('PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM') &&
                  img.imageUrl !== 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg==';
          });
          
          if (session.images.length !== originalImageCount) {
            isDirty = true;
          }
        }
        
        // Kiểm tra trùng lặp bằng sessionId
        const existingSession = sessionMap.get(session.sessionId);
        
        if (existingSession) {
          isDirty = true;
          
          // So sánh thời gian để giữ bản mới nhất
          const existingTime = new Date(existingSession.timestamp || existingSession.createdAt || 0).getTime();
          const currentTime = new Date(session.timestamp || session.createdAt || 0).getTime();
          
          if (currentTime > existingTime) {
            sessionMap.set(session.sessionId, session);
          }
        } else {
          sessionMap.set(session.sessionId, session);
        }
      }
      
      // Nếu có thay đổi, cập nhật storage
      if (isDirty) {
        // Chuyển đổi Map thành array
        const deduplicatedSessions = Array.from(sessionMap.values());
        
        // Xóa bỏ các session không có ảnh
        const validSessions = deduplicatedSessions.filter(session => 
          session.images && Array.isArray(session.images) && session.images.length > 0
        );
        
        // Lưu dữ liệu đã deduplicate
        if (this.db) {
          const tx = this.db.transaction('sessions', 'readwrite');
          const store = tx.objectStore('sessions');
          
          // Xóa tất cả sessions hiện có
          await new Promise<void>((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e: any) => reject(e.target.error);
          });
          
          // Thêm lại các sessions đã deduplicate
          for (const session of validSessions) {
            await new Promise<void>((resolve, reject) => {
              const request = store.add(session);
              request.onsuccess = () => resolve();
              request.onerror = (e: any) => {
                console.warn(`⚠️ Không thể thêm lại session ${session.sessionId}:`, e.target.error);
                resolve(); // Tiếp tục dù có lỗi
              };
            });
          }
        } else {
          // Cập nhật localStorage
          localStorage.setItem('Image_Generator_Sessions', JSON.stringify(validSessions));
        }
        
        this.logDebug(`🧹 Deduplicate thành công: ${originalCount} → ${validSessions.length} sessions (loại bỏ ${invalidCount} không hợp lệ, ${originalCount - invalidCount - validSessions.length} trùng lặp)`);
      } else {
        this.logDebug(`✅ Không tìm thấy dữ liệu trùng lặp hoặc không hợp lệ`);
      }
    } catch (error) {
      console.error('❌ Lỗi khi deduplicate dữ liệu:', error);
    }
  }

  /**
   * Helper để đợi cho đến khi lock được giải phóng
   */
  private async waitForLock(): Promise<void> {
    if (!this.operationLock) return;
    
    return new Promise<void>(resolve => {
      const operation = async () => {
        resolve();
      };
      
      this.operationQueue.push(operation);
    });
  }

  /**
   * Xử lý hàng đợi thao tác
   */
  private async processQueue(): Promise<void> {
    if (this.operationQueue.length === 0 || this.operationLock) return;
    
    const operation = this.operationQueue.shift();
    if (operation) {
      this.operationLock = true;
      try {
        await operation();
      } finally {
        this.operationLock = false;
        this.processQueue();
      }
    }
  }

  /**
   * Đợi cho đến khi khởi tạo hoàn thành
   */
  private async waitForInit(): Promise<void> {
    if (this.isInitialized) return;
    
    let attempts = 0;
    const maxAttempts = 50;
    const delay = 100;
    
    while (!this.isInitialized && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    }
    
    if (!this.isInitialized) {
      console.warn('⚠️ Đã đạt số lần thử tối đa khi đợi khởi tạo');
      this.isInitialized = true; // Đánh dấu đã khởi tạo để không bị treo
    }
  }

  /**
   * Log debug nếu được bật
   */
  private logDebug(message: string, ...args: any[]): void {
    if (this.DEBUG) {
      console.log(`🔍 [StorageManager] ${message}`, ...args);
    }
  }
}

/**
 * Lớp hỗ trợ nén ảnh
 */
class ImageCompressor {
  /**
   * Nén ảnh để giảm kích thước lưu trữ
   */
  static async compressImage(dataUrl: string, quality = 0.8, maxWidth = 1200): Promise<{blob: Blob, dataUrl: string, width: number, height: number}> {
    return new Promise((resolve, reject) => {
      try {
        // Bỏ qua nếu không phải data URL hợp lệ
        if (!dataUrl || !dataUrl.startsWith('data:')) {
          throw new Error('Invalid data URL');
        }
        
        // Bỏ qua nếu là placeholder
        if (dataUrl.includes('PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM') ||
            dataUrl === 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg==') {
          throw new Error('Placeholder image detected');
        }
        
        const img = new Image();
        img.onload = () => {
          // Tạo canvas
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Thay đổi kích thước nếu cần
          if (width > maxWidth) {
            height = Math.floor(height * (maxWidth / width));
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Vẽ và nén
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Failed to get canvas context');
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Chuyển đổi sang blob
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }
            
            // Lấy cả data URL cho các trường hợp cần thiết
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            
            resolve({
              blob,
              dataUrl: compressedDataUrl,
              width,
              height
            });
          }, 'image/jpeg', quality);
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image for compression'));
        };
        
        img.src = dataUrl;
      } catch (error) {
        reject(error);
      }
    });
  }
}

/**
 * Hỗ trợ di chuyển dữ liệu từ storage cũ
 */
class StorageMigration {
  /**
   * Di chuyển dữ liệu từ localStorage cũ
   */
  static async migrateFromOldLocalStorage(storageManager: StorageManager): Promise<boolean> {
    try {
      // Kiểm tra nếu đã migrate
      if (localStorage.getItem('migration_completed') === 'true') {
        console.log('✅ Migration đã hoàn thành');
        return true;
      }
      
      console.log('🔄 Bắt đầu di chuyển dữ liệu từ localStorage cũ...');
      
      // Lấy dữ liệu từ định dạng cũ
      const oldDataJson = localStorage.getItem('Image_Generator_Sessions');
      if (!oldDataJson) {
        console.log('📭 Không tìm thấy dữ liệu cũ');
        localStorage.setItem('migration_completed', 'true');
        return true;
      }
      
      const oldData = JSON.parse(oldDataJson);
      if (!Array.isArray(oldData) || oldData.length === 0) {
        console.log('📭 Không tìm thấy dữ liệu cũ hợp lệ');
        localStorage.setItem('migration_completed', 'true');
        return true;
      }
      
      console.log(`📊 Tìm thấy ${oldData.length} sessions để di chuyển`);
      
      // Deduplicate dữ liệu cũ trước
      const uniqueIds = new Set();
      const uniqueOldData = oldData.filter(session => {
        if (!session.sessionId) return false;
        if (uniqueIds.has(session.sessionId)) return false;
        uniqueIds.add(session.sessionId);
        return true;
      });
      
      console.log(`🧹 Đã deduplicate thành ${uniqueOldData.length} sessions duy nhất`);
      
      // Lưu từng session vào storage mới
      for (const session of uniqueOldData) {
        await storageManager.saveSession({
          sessionId: session.sessionId,
          describe: session.describe || '',
          images: session.images || []
        });
      }
      
      // Đánh dấu đã hoàn thành migration
      localStorage.setItem('migration_completed', 'true');
      
      // Tạo backup dữ liệu cũ phòng khi cần
      localStorage.setItem('Image_Generator_Sessions_BACKUP', oldDataJson);
      
      console.log('✅ Migration hoàn thành thành công');
      return true;
    } catch (error) {
      console.error('❌ Lỗi migration:', error);
      return false;
    }
  }
}

// Tạo singleton instance
const storageManager = new StorageManager();

// Export các lớp và singleton
export { StorageManager, ImageCompressor, StorageMigration, storageManager };