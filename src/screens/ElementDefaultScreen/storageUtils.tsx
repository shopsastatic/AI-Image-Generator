// ROBUST Storage Solution - Fixed Migration & Recovery
interface CompressedImageResult {
  thumbnail: string;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
}

class ImageCompressor {
  static async compressImage(imageBase64: string): Promise<CompressedImageResult> {
    try {
      const img = await this.loadImage(imageBase64);
      const thumbnail = this.createThumbnail(img);
      const blob = await this.imageToBlob(img);
      
      return {
        thumbnail,
        blob,
        originalSize: this.calculateBase64Size(imageBase64),
        compressedSize: blob.size
      };
    } catch (error) {
      console.warn('Compression failed, using fallback:', error);
      return await this.fallbackCompress(imageBase64);
    }
  }

  private static loadImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = base64;
    });
  }

  private static createThumbnail(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const size = 150;
    const { width, height } = this.calculateDimensions(img.width, img.height, size);
    
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, width, height);
    
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  private static async imageToBlob(img: HTMLImageElement): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const { width, height } = this.calculateDimensions(img.width, img.height, 1024);
    
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, width, height);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        'image/jpeg',
        0.8
      );
    });
  }

  private static calculateDimensions(originalWidth: number, originalHeight: number, maxSize: number) {
    let { width, height } = { width: originalWidth, height: originalHeight };
    
    if (width > height) {
      if (width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
    }
    
    return { width: Math.round(width), height: Math.round(height) };
  }

  private static calculateBase64Size(base64: string): number {
    return Math.round((base64.length * (3/4)) - (base64.match(/=/g) || []).length);
  }

  private static async fallbackCompress(imageBase64: string): Promise<CompressedImageResult> {
    const response = await fetch(imageBase64);
    const blob = await response.blob();
    
    return {
      thumbnail: imageBase64,
      blob,
      originalSize: this.calculateBase64Size(imageBase64),
      compressedSize: blob.size
    };
  }
}

interface ImageRecord {
  id: string;
  sessionId: string;
  imageIndex: number;
  blob: Blob;
  prompt: string;
  claudeResponse?: string;
  timestamp: string;
  size: string;
  quality: string;
  AdCreativeA?: string;
  AdCreativeB?: string;
}

interface SessionMetadata {
  sessionId: string;
  describe: string;
  timestamp: string;
  imageCount: number;
  thumbnail: string;
  date: string;
}

class IndexedDBManager {
  private dbName = 'AIImageGenerator';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'id' });
          imageStore.createIndex('sessionId', 'sessionId', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
          sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveSession(sessionData: {
    sessionId: string;
    describe: string;
    images: Array<{
      imageBase64: string;
      prompt: string;
      claudeResponse?: string;
      timestamp: string;
      size: string;
      quality: string;
      AdCreativeA?: string;
      AdCreativeB?: string;
    }>;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log(`🔄 Starting compression for ${sessionData.images.length} images...`);
    
    const compressedImages = await Promise.all(
      sessionData.images.map(async (img, index) => {
        const compressed = await ImageCompressor.compressImage(img.imageBase64);
        return { ...img, compressed, index };
      })
    );
    
    console.log('✅ Compression completed, saving to IndexedDB...');

    const transaction = this.db.transaction(['images', 'sessions'], 'readwrite');
    const imageStore = transaction.objectStore('images');
    const sessionStore = transaction.objectStore('sessions');

    for (const { compressed, index, ...img } of compressedImages) {
      const imageRecord: ImageRecord = {
        id: `${sessionData.sessionId}-${index}`,
        sessionId: sessionData.sessionId,
        imageIndex: index,
        blob: compressed.blob,
        prompt: img.prompt,
        claudeResponse: img.claudeResponse,
        timestamp: img.timestamp,
        size: img.size,
        quality: img.quality,
        AdCreativeA: img.AdCreativeA,
        AdCreativeB: img.AdCreativeB,
      };

      imageStore.add(imageRecord);
    }

    const sessionMetadata: SessionMetadata = {
      sessionId: sessionData.sessionId,
      describe: sessionData.describe,
      timestamp: sessionData.images[0]?.timestamp || new Date().toISOString(),
      imageCount: sessionData.images.length,
      thumbnail: compressedImages[0]?.compressed.thumbnail || '',
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };

    sessionStore.add(sessionMetadata);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`✅ IndexedDB save successful: ${sessionData.sessionId}`);
        resolve();
      };
      transaction.onerror = () => {
        console.error('❌ IndexedDB save failed:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  async getSessionMetadata(): Promise<SessionMetadata[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(sessions);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionImages(sessionId: string): Promise<ImageRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => {
        const images = request.result.sort((a, b) => a.imageIndex - b.imageIndex);
        resolve(images);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async cleanup(maxSessions: number = 100): Promise<void> {
    if (!this.db) return;

    try {
      const sessions = await this.getSessionMetadata();
      
      if (sessions.length <= maxSessions) return;

      const sessionsToDelete = sessions.slice(maxSessions);
      const transaction = this.db.transaction(['images', 'sessions'], 'readwrite');
      const imageStore = transaction.objectStore('images');
      const sessionStore = transaction.objectStore('sessions');

      for (const session of sessionsToDelete) {
        const imageIndex = imageStore.index('sessionId');
        const imageRequest = imageIndex.openCursor(IDBKeyRange.only(session.sessionId));
        
        imageRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        sessionStore.delete(session.sessionId);
      }

      console.log(`🧹 Cleaned up ${sessionsToDelete.length} old sessions`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

interface HistoryDateGroup {
  date: string;
  items: Array<{
    id: string;
    describe: string;
    thumbnail: string;
    imageCount: number;
    timestamp: string;
  }>;
}

class HybridStorageManager {
  private indexedDB = new IndexedDBManager();
  private initialized = false;
  private migrationCompleted = false;

  async init(): Promise<void> {
    try {
      await this.indexedDB.init();
      this.initialized = true;
      console.log('✅ Storage initialized');
      
      // Check migration status
      const migrationStatus = localStorage.getItem('migration_completed');
      if (!migrationStatus) {
        await this.performSafeMigration();
      }
      
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      throw error;
    }
  }

  async saveSession(sessionData: {
    sessionId: string;
    describe: string;
    images: Array<{
      imageBase64: string;
      prompt: string;
      claudeResponse?: string;
      timestamp: string;
      size: string;
      quality: string;
      AdCreativeA?: string;
      AdCreativeB?: string;
    }>;
  }): Promise<void> {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    let indexedDBSuccess = false;

    // Try IndexedDB FIRST (primary storage)
    try {
      await this.indexedDB.saveSession(sessionData);
      await this.indexedDB.cleanup();
      indexedDBSuccess = true;
      console.log(`✅ Session saved to IndexedDB successfully`);
    } catch (error) {
      console.error('❌ IndexedDB save failed:', error);
    }

    // Try localStorage as backup (with compression)
    try {
      await this.saveToLocalStorage(sessionData);
      console.log(`✅ Session also saved to localStorage backup`);
    } catch (error) {
      console.warn('⚠️ localStorage save failed (probably full):', error.message);
      
      if (!indexedDBSuccess) {
        // Both failed - this is bad
        throw new Error('Both IndexedDB and localStorage failed to save');
      }
      
      // IndexedDB worked, localStorage failed - that's OK
      console.log('✅ Data saved to IndexedDB (localStorage backup failed but that\'s OK)');
    }

    if (indexedDBSuccess) {
      console.log(`💾 Session saved successfully (Primary: IndexedDB)`);
    } else {
      console.log(`💾 Session saved successfully (Fallback: localStorage only)`);
    }
  }

  async getHistoryForSidebar(): Promise<HistoryDateGroup[]> {
    let indexedDBData: HistoryDateGroup[] = [];
    let localStorageData: HistoryDateGroup[] = [];

    // Try IndexedDB first (primary source)
    try {
      if (this.initialized) {
        const sessions = await this.indexedDB.getSessionMetadata();
        if (sessions && sessions.length > 0) {
          indexedDBData = this.groupSessionsByDate(sessions);
          console.log('📊 Loaded from IndexedDB:', sessions.length, 'sessions');
        }
      }
    } catch (error) {
      console.warn('⚠️ IndexedDB load failed:', error);
    }

    // Also get localStorage data
    try {
      localStorageData = this.getFromLocalStorage();
      if (localStorageData.length > 0) {
        console.log('📊 Also found localStorage data:', localStorageData.length, 'groups');
      }
    } catch (error) {
      console.warn('⚠️ localStorage load failed:', error);
    }

    // Merge data, preferring IndexedDB but including localStorage items not in IndexedDB
    const mergedData = this.mergeHistoryData(indexedDBData, localStorageData);
    
    console.log('📊 Final merged history:', mergedData.length, 'date groups');
    return mergedData;
  }

  private mergeHistoryData(indexedDBData: HistoryDateGroup[], localStorageData: HistoryDateGroup[]): HistoryDateGroup[] {
    if (indexedDBData.length === 0) {
      return localStorageData;
    }
    
    if (localStorageData.length === 0) {
      return indexedDBData;
    }

    // Create a map of existing items from IndexedDB
    const indexedDBIds = new Set<string>();
    indexedDBData.forEach(group => {
      group.items.forEach(item => {
        indexedDBIds.add(item.id);
      });
    });

    // Merge localStorage items that aren't in IndexedDB
    const merged = [...indexedDBData];
    
    localStorageData.forEach(localGroup => {
      localGroup.items.forEach(localItem => {
        if (!indexedDBIds.has(localItem.id)) {
          // Find or create date group
          let targetGroup = merged.find(g => g.date === localGroup.date);
          if (!targetGroup) {
            targetGroup = { date: localGroup.date, items: [] };
            merged.push(targetGroup);
          }
          
          targetGroup.items.push(localItem);
        }
      });
    });

    // Sort by date
    return merged.sort((a, b) => 
      new Date(b.items[0]?.timestamp || 0).getTime() - new Date(a.items[0]?.timestamp || 0).getTime()
    );
  }

  async getSessionImages(sessionId: string): Promise<Array<{
    imageUrl: string;
    prompt: string;
    claudeResponse?: string;
    timestamp: string;
    size: string;
    quality: string;
    AdCreativeA?: string;
    AdCreativeB?: string;
  }>> {
    // Try IndexedDB first (has full quality images)
    try {
      if (this.initialized) {
        const images = await this.indexedDB.getSessionImages(sessionId);
        if (images && images.length > 0) {
          console.log('📸 Loaded full-quality images from IndexedDB:', images.length);
          return images.map((img) => ({
            imageUrl: URL.createObjectURL(img.blob),
            prompt: img.prompt,
            claudeResponse: img.claudeResponse,
            timestamp: img.timestamp,
            size: img.size,
            quality: img.quality,
            AdCreativeA: img.AdCreativeA,
            AdCreativeB: img.AdCreativeB,
          }));
        }
      }
    } catch (error) {
      console.warn('⚠️ IndexedDB session load failed:', error);
    }

    // Fallback to localStorage (compressed images)
    console.log('📸 Falling back to localStorage images (compressed quality)');
    return this.getSessionFromLocalStorage(sessionId);
  }

  private async performSafeMigration(): Promise<void> {
    try {
      console.log('🔄 Starting safe migration...');
      
      // Check if there's data to migrate
      const oldData = localStorage.getItem('Image_Generator_Sessions');
      const backupData = localStorage.getItem('Image_Generator_Sessions_BACKUP');
      
      if (!oldData && !backupData) {
        console.log('✅ No data to migrate');
        localStorage.setItem('migration_completed', 'true');
        return;
      }

      // Use backup data if original is missing
      const dataToMigrate = oldData || backupData;
      if (!dataToMigrate) {
        console.log('✅ No valid data found for migration');
        localStorage.setItem('migration_completed', 'true');
        return;
      }

      const sessions = JSON.parse(dataToMigrate);
      let migratedCount = 0;
      let failedCount = 0;

      for (const dateGroup of sessions) {
        if (!dateGroup.items) continue;
        
        for (const item of dateGroup.items) {
          if (item.list && item.list.length > 0) {
            try {
              await this.indexedDB.saveSession({
                sessionId: item.id,
                describe: item.describe || 'Migrated session',
                images: item.list
              });
              migratedCount++;
              console.log(`✅ Migrated session: ${item.id}`);
            } catch (error) {
              failedCount++;
              console.warn(`⚠️ Failed to migrate session ${item.id}:`, error);
            }
          }
        }
      }

      // Only mark as completed if migration was successful
      if (migratedCount > 0) {
        // Keep original data as backup, don't delete
        if (oldData) {
          localStorage.setItem('Image_Generator_Sessions_BACKUP', oldData);
        }
        localStorage.setItem('migration_completed', 'true');
        console.log(`✅ Migration completed: ${migratedCount} sessions migrated, ${failedCount} failed`);
      } else {
        console.warn('⚠️ Migration failed, keeping original data');
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      // Don't mark as completed on failure
    }
  }

  private async saveToLocalStorage(sessionData: any): Promise<void> {
    try {
      // First, try to cleanup localStorage to make space
      await this.cleanupLocalStorage();
      
      const existingData = this.getLocalStorageData();
      
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      let todayGroup = existingData.find((group: any) => group.date === today);
      
      if (!todayGroup) {
        todayGroup = { date: today, items: [] };
        existingData.unshift(todayGroup);
      }

      // Compress images for localStorage
      const compressedImages = await Promise.all(
        sessionData.images.map(async (img: any) => {
          try {
            // Create smaller version for localStorage
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            const image = new Image();
            
            return new Promise<any>((resolve) => {
              image.onload = () => {
                // Very small size for localStorage
                const maxSize = 200;
                let { width, height } = image;
                
                if (width > height) {
                  if (width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                  }
                } else {
                  if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                  }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(image, 0, 0, width, height);
                
                resolve({
                  ...img,
                  imageBase64: canvas.toDataURL('image/jpeg', 0.5) // Low quality for space
                });
              };
              
              image.onerror = () => {
                // Use original if compression fails
                resolve(img);
              };
              
              image.src = img.imageBase64;
            });
          } catch {
            return img; // Return original if compression fails
          }
        })
      );

      const newItem = {
        id: sessionData.sessionId,
        isSelected: false,
        describe: sessionData.describe,
        list: compressedImages
      };

      todayGroup.items.unshift(newItem);
      
      // Keep only very recent data for localStorage (to avoid quota issues)
      const limitedData = existingData.slice(0, 5); // Only 5 days
      
      // Try to save, if still fails, reduce further
      try {
        localStorage.setItem('Image_Generator_Sessions', JSON.stringify(limitedData));
        console.log('✅ Saved to localStorage (compressed)');
      } catch (quotaError) {
        console.warn('⚠️ Still quota exceeded, trying with only today\'s data');
        
        // Emergency: save only today's data
        const emergencyData = [todayGroup];
        localStorage.setItem('Image_Generator_Sessions', JSON.stringify(emergencyData));
        console.log('✅ Saved to localStorage (emergency mode - today only)');
      }
      
    } catch (error) {
      console.error('❌ localStorage save failed completely:', error);
      throw error;
    }
  }

  private async cleanupLocalStorage(): Promise<void> {
    try {
      const data = this.getLocalStorageData();
      
      if (data.length > 7) {
        // Keep only last 7 days
        const recentData = data.slice(0, 7);
        localStorage.setItem('Image_Generator_Sessions', JSON.stringify(recentData));
        console.log('🧹 Cleaned up localStorage: kept only 7 recent days');
      }
      
      // Also clean up other localStorage keys that might be taking space
      const keysToClean = [
        'Image_Generator_Sessions_Fallback',
        'backup_v1'
      ];
      
      keysToClean.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`🧹 Removed old localStorage key: ${key}`);
        }
      });
      
    } catch (error) {
      console.warn('⚠️ localStorage cleanup failed:', error);
    }
  }

  private getFromLocalStorage(): HistoryDateGroup[] {
    try {
      const data = this.getLocalStorageData();
      return data.map((group: any) => ({
        date: group.date,
        items: group.items.map((item: any) => ({
          id: item.id,
          describe: item.describe,
          thumbnail: item.list && item.list[0] ? item.list[0].imageBase64 : '',
          imageCount: item.list ? item.list.length : 0,
          timestamp: item.list && item.list[0] ? item.list[0].timestamp : new Date().toISOString()
        }))
      }));
    } catch (error) {
      console.error('❌ localStorage load failed:', error);
      return [];
    }
  }

  private getSessionFromLocalStorage(sessionId: string): Array<any> {
    try {
      const data = this.getLocalStorageData();
      
      for (const group of data) {
        const item = group.items.find((item: any) => item.id === sessionId);
        if (item && item.list) {
          return item.list.map((img: any) => ({
            imageUrl: img.imageBase64,
            prompt: img.prompt,
            claudeResponse: img.claudeResponse,
            timestamp: img.timestamp,
            size: img.size,
            quality: img.quality,
            AdCreativeA: img.AdCreativeA,
            AdCreativeB: img.AdCreativeB,
          }));
        }
      }
      
      return [];
    } catch (error) {
      console.error('❌ localStorage session load failed:', error);
      return [];
    }
  }

  private getLocalStorageData(): any[] {
    try {
      // Try current storage first
      let data = localStorage.getItem('Image_Generator_Sessions');
      if (data) {
        return JSON.parse(data);
      }
      
      // Try backup if current doesn't exist
      data = localStorage.getItem('Image_Generator_Sessions_BACKUP');
      if (data) {
        console.log('📦 Loading from backup storage');
        // Restore from backup
        localStorage.setItem('Image_Generator_Sessions', data);
        return JSON.parse(data);
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error reading localStorage:', error);
      return [];
    }
  }

  private groupSessionsByDate(sessions: SessionMetadata[]): HistoryDateGroup[] {
    const groups: { [date: string]: HistoryDateGroup } = {};

    sessions.forEach(session => {
      if (!groups[session.date]) {
        groups[session.date] = {
          date: session.date,
          items: []
        };
      }

      groups[session.date].items.push({
        id: session.sessionId,
        describe: session.describe,
        thumbnail: session.thumbnail,
        imageCount: session.imageCount,
        timestamp: session.timestamp
      });
    });

    return Object.values(groups).sort((a, b) => 
      new Date(b.items[0].timestamp).getTime() - new Date(a.items[0].timestamp).getTime()
    );
  }
}

class StorageMigration {
  static async migrateFromOldLocalStorage(hybridStorage: HybridStorageManager): Promise<void> {
    // This method is now handled internally by HybridStorageManager
    console.log('⚠️ Migration is now handled automatically by HybridStorageManager');
  }
}

const storageManager = new HybridStorageManager();

export {
  HybridStorageManager,
  IndexedDBManager,
  ImageCompressor,
  StorageMigration,
  storageManager
};