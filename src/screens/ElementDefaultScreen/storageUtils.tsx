interface ImageData {
    imageUrl: string;
    prompt: string;
    timestamp: string;
    size?: string;
    quality?: string;
    platform?: string;
    claudeResponse?: string;
    AdCreativeA?: string;
    AdCreativeB?: string;
    targeting?: string;
    imageName?: string;
    isBlob?: boolean;
    originalBase64?: string;
}

// ✅ THÊM MỚI: Interface cho file upload
interface UploadedFile {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    imageBase64: string;
    timestamp: string;
    lastUsed?: string;
    usageCount: number;
}

interface SessionData {
    sessionId: string;
    describe?: string;
    platform?: string;
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

class StorageManager {
    private db: IDBDatabase | null = null;
    private isInitialized: boolean = false;
    private readonly dbName: string = "AIImageGenerator";
    private readonly dbVersion: number = 2; // Tăng version để cập nhật schema
    private pendingSaves: Map<string, any> = new Map();
    private sessionsCache: any[] | null = null;
    private lastCacheTime: number = 0;
    private operationLock: boolean = false;
    private operationQueue: Array<() => Promise<void>> = [];
    private readonly DEBUG: boolean = true; // Bật/tắt log debug

    constructor() {
        this.logDebug("StorageManager được khởi tạo");
    }

    async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    this.isInitialized = true;
                    resolve();
                    return;
                }

                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = (event) => {
                    this.isInitialized = true;
                    resolve();
                };

                request.onsuccess = (event: any) => {
                    this.db = event.target.result;
                    this.isInitialized = true;

                    // Thiết lập error handler
                    this.db.onerror = (event: any) => {
                        console.error(
                            "❌ Lỗi database:",
                            event.target.errorCode
                        );
                    };

                    // Thực hiện deduplicate khi khởi động
                    this.deduplicateOnStartup()
                        .then(() => {
                            resolve();
                        })
                        .catch((err) => {
                            resolve(); // Vẫn resolve dù có lỗi
                        });
                };

                request.onupgradeneeded = (event: any) => {
                    const db = event.target.result;

                    if (db.objectStoreNames.contains("sessions")) {
                        db.deleteObjectStore("sessions");
                    }

                    const store = db.createObjectStore("sessions", {
                        keyPath: "sessionId",
                    });
                    store.createIndex("timestamp", "timestamp", {
                        unique: false,
                    });
                    store.createIndex("createdAt", "createdAt", {
                        unique: false,
                    });

                    if (!db.objectStoreNames.contains("uploadedFiles")) {
                        const filesStore = db.createObjectStore(
                            "uploadedFiles",
                            { keyPath: "id" }
                        );
                        filesStore.createIndex("timestamp", "timestamp", {
                            unique: false,
                        });
                        filesStore.createIndex("fileName", "fileName", {
                            unique: false,
                        });
                        filesStore.createIndex("lastUsed", "lastUsed", {
                            unique: false,
                        });
                    }
                };
            });
        } catch (error) {
            this.isInitialized = true;
        }
    }

    async saveSession(sessionData: SessionData): Promise<string> {
        await this.waitForInit();

        try {
            if (!sessionData.sessionId) {
                throw new Error("Session ID là bắt buộc");
            }

            await this.waitForLock();
            this.operationLock = true;

            try {
                const existingSessions = await this.getAllSessionsInternal();
                const existingSession = existingSessions.find(
                    (session) => session.sessionId === sessionData.sessionId
                );

                const now = new Date().toISOString();
                const session = {
                    sessionId: sessionData.sessionId,
                    describe: sessionData.describe || "",
                    platform: sessionData.platform || "",
                    createdAt: existingSession?.createdAt || now,
                    timestamp: now,
                    images: [],
                };

                if (sessionData.images && sessionData.images.length > 0) {
                    for (const image of sessionData.images) {
                        // Đảm bảo có đủ dữ liệu cho mỗi ảnh
                        const imageData: ImageData = {
                            imageUrl: image.imageBase64 || image.imageUrl || "",
                            prompt: image.prompt || "",
                            platform: image.platform || "",
                            timestamp: image.timestamp || now,
                            size: image.size || "Square",
                            quality: image.quality || "Standard",
                        };

                        if (image.claudeResponse)
                            imageData.claudeResponse = image.claudeResponse;
                        if (image.AdCreativeA)
                            imageData.AdCreativeA = image.AdCreativeA;
                        if (image.AdCreativeB)
                            imageData.AdCreativeB = image.AdCreativeB;
                        if (image.targeting)
                            imageData.targeting = image.targeting;
                        if (image.imageName)
                            imageData.imageName = image.imageName;

                        if (
                            !imageData.imageUrl ||
                            imageData.imageUrl.includes(
                                "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM"
                            ) ||
                            imageData.imageUrl ===
                                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
                        ) {
                            this.logDebug(
                                `⚠️ Bỏ qua ảnh rỗng hoặc placeholder`
                            );
                            continue;
                        }

                        (session.images as any).push(imageData);
                    }
                }

                if (session.images.length === 0) {
                    return sessionData.sessionId;
                }

                if (this.db) {
                    const tx = this.db.transaction("sessions", "readwrite");
                    const store = tx.objectStore("sessions");

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
                    if (existingSession) {
                        const index = existingSessions.findIndex(
                            (s) => s.sessionId === sessionData.sessionId
                        );
                        if (index !== -1) {
                            existingSessions[index] = session;
                        } else {
                            existingSessions.push(session);
                        }
                    } else {
                        existingSessions.push(session);
                    }

                    localStorage.setItem(
                        "Image_Generator_Sessions",
                        JSON.stringify(existingSessions)
                    );
                }

                this.sessionsCache = null;
                return sessionData.sessionId;
            } finally {
                this.operationLock = false;
                this.processQueue();
            }
        } catch (error) {
            this.operationLock = false;
            this.processQueue();
            throw error;
        }
    }

    async getAllSessions(): Promise<any[]> {
        await this.waitForInit();

        try {
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
            this.operationLock = false;
            this.processQueue();
            return [];
        }
    }

    private async getAllSessionsInternal(): Promise<any[]> {
        try {
            if (this.sessionsCache && Date.now() - this.lastCacheTime < 2000) {
                return this.sessionsCache;
            }

            let sessions = [];

            if (this.db) {
                const tx = this.db.transaction("sessions", "readonly");
                const store = tx.objectStore("sessions");

                sessions = await new Promise<any[]>((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = (e: any) => reject(e.target.error);
                });
            } else {
                try {
                    const sessionsJson = localStorage.getItem(
                        "Image_Generator_Sessions"
                    );
                    if (sessionsJson) {
                        sessions = JSON.parse(sessionsJson);
                    }
                } catch (parseError) {
                    console.error(
                        "❌ Lỗi parse sessions từ localStorage:",
                        parseError
                    );
                }
            }

            const validatedSessions =
                this.validateAndDeduplicateSessions(sessions);

            this.sessionsCache = validatedSessions;
            this.lastCacheTime = Date.now();

            return validatedSessions;
        } catch (error) {
            console.error("❌ Lỗi lấy sessions nội bộ:", error);
            return [];
        }
    }

    validateAndDeduplicateSessions(sessions: any[]): any[] {
        if (!Array.isArray(sessions)) {
            this.logDebug("⚠️ Sessions không phải array, trả về array rỗng");
            return [];
        }

        const sessionMap = new Map();
        const validSessions = [];

        for (const session of sessions) {
            if (!session || !session.sessionId || !session.images) {
                continue;
            }

            const validImages = (session.images || []).filter((img: any) => {
                return (
                    img &&
                    img.imageUrl &&
                    !img.imageUrl.includes(
                        "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM"
                    ) &&
                    img.imageUrl !==
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
                );
            });

            if (validImages.length === 0) {
                continue;
            }

            const updatedSession = {
                ...session,
                images: validImages,
            };

            const existingSession = sessionMap.get(session.sessionId);

            if (existingSession) {
                const existingTime = new Date(
                    existingSession.timestamp || existingSession.createdAt || 0
                ).getTime();
                const currentTime = new Date(
                    session.timestamp || session.createdAt || 0
                ).getTime();

                if (currentTime > existingTime) {
                    sessionMap.set(session.sessionId, updatedSession);
                }
            } else {
                sessionMap.set(session.sessionId, updatedSession);
            }
        }

        for (const session of sessionMap.values()) {
            validSessions.push(session);
        }

        validSessions.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
            const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        if (!this.db && validSessions.length !== sessions.length) {
            localStorage.setItem(
                "Image_Generator_Sessions",
                JSON.stringify(validSessions)
            );
        }

        return validSessions;
    }

    async getHistoryForSidebar(): Promise<HistoryGroup[]> {
        await this.waitForInit();

        try {
            const sessions = await this.getAllSessions();

            if (!sessions || sessions.length === 0) {
                return [];
            }

            const groupedByDate = this.groupSessionsByDate(sessions);
            return groupedByDate;
        } catch (error) {
            console.error("❌ Lỗi lấy history cho sidebar:", error);
            return [];
        }
    }

    private groupSessionsByDate(sessions: any[]): HistoryGroup[] {
        const groups: HistoryGroup[] = [];
        const dateMap = new Map<string, HistoryGroup>();

        for (const session of sessions) {
            if (!session.images || session.images.length === 0) {
                continue;
            }

            const timestamp = session.timestamp || session.createdAt;
            const date = timestamp
                ? new Date(timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                  })
                : "Unknown Date";

            let group = dateMap.get(date);
            if (!group) {
                group = { date, items: [] };
                dateMap.set(date, group);
                groups.push(group);
            }

            const firstImage = session.images[0];
            const thumbnailImage = firstImage?.imageUrl || "";

            group.items.push({
                id: session.sessionId,
                describe: session.describe || "",
                thumbnail: thumbnailImage,
                imageCount: session.images.length,
            });
        }

        groups.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });

        return groups;
    }

    async getSessionImages(sessionId: string): Promise<ImageData[]> {
        await this.waitForInit();

        try {
            const sessions = await this.getAllSessions();
            const session = sessions.find((s) => s.sessionId === sessionId);

            if (!session || !session.images || session.images.length === 0) {
                return [];
            }

            const validImages = session.images.filter((img: ImageData) => {
                return (
                    img &&
                    img.imageUrl &&
                    !img.imageUrl.includes(
                        "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM"
                    ) &&
                    img.imageUrl !==
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
                );
            });

            return validImages;
        } catch (error) {
            console.error(`❌ Lỗi lấy ảnh cho session ${sessionId}:`, error);
            return [];
        }
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        await this.waitForInit();

        try {
            await this.waitForLock();
            this.operationLock = true;

            try {
                if (this.db) {
                    const tx = this.db.transaction("sessions", "readwrite");
                    const store = tx.objectStore("sessions");

                    await new Promise<void>((resolve, reject) => {
                        const request = store.delete(sessionId);
                        request.onsuccess = () => resolve();
                        request.onerror = (e: any) => reject(e.target.error);
                    });
                } else {
                    const sessions = await this.getAllSessionsInternal();
                    const filteredSessions = sessions.filter(
                        (s) => s.sessionId !== sessionId
                    );
                    localStorage.setItem(
                        "Image_Generator_Sessions",
                        JSON.stringify(filteredSessions)
                    );
                }

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

    async clearAllSessions(): Promise<boolean> {
        await this.waitForInit();

        try {
            // Đợi thao tác khác hoàn thành
            await this.waitForLock();
            this.operationLock = true;

            try {
                if (this.db) {
                    const tx = this.db.transaction("sessions", "readwrite");
                    const store = tx.objectStore("sessions");

                    await new Promise<void>((resolve, reject) => {
                        const request = store.clear();
                        request.onsuccess = () => resolve();
                        request.onerror = (e: any) => reject(e.target.error);
                    });
                } else {
                    // Xóa từ localStorage
                    localStorage.removeItem("Image_Generator_Sessions");
                    localStorage.removeItem("Image_Generator_Sessions_BACKUP");
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
            let sessions: any[] = [];
            let isDirty = false;

            if (this.db) {
                const tx = this.db.transaction("sessions", "readonly");
                const store = tx.objectStore("sessions");

                sessions = await new Promise<any[]>((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = (e: any) => reject(e.target.error);
                });
            } else {
                try {
                    const sessionsJson = localStorage.getItem(
                        "Image_Generator_Sessions"
                    );
                    if (sessionsJson) {
                        sessions = JSON.parse(sessionsJson);
                    }
                } catch (parseError) {
                    console.error(
                        "❌ Lỗi parse sessions từ localStorage:",
                        parseError
                    );
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
                        return (
                            img &&
                            img.imageUrl &&
                            !img.imageUrl.includes(
                                "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM"
                            ) &&
                            img.imageUrl !==
                                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
                        );
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
                    const existingTime = new Date(
                        existingSession.timestamp ||
                            existingSession.createdAt ||
                            0
                    ).getTime();
                    const currentTime = new Date(
                        session.timestamp || session.createdAt || 0
                    ).getTime();

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
                const validSessions = deduplicatedSessions.filter(
                    (session) =>
                        session.images &&
                        Array.isArray(session.images) &&
                        session.images.length > 0
                );

                // Lưu dữ liệu đã deduplicate
                if (this.db) {
                    const tx = this.db.transaction("sessions", "readwrite");
                    const store = tx.objectStore("sessions");

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
                                resolve(); // Tiếp tục dù có lỗi
                            };
                        });
                    }
                } else {
                    // Cập nhật localStorage
                    localStorage.setItem(
                        "Image_Generator_Sessions",
                        JSON.stringify(validSessions)
                    );
                }
            }
        } catch (error) {
            console.error("❌ Lỗi khi deduplicate dữ liệu:", error);
        }
    }

    /**
     * Helper để đợi cho đến khi lock được giải phóng
     */
    private async waitForLock(): Promise<void> {
        if (!this.operationLock) return;

        return new Promise<void>((resolve) => {
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

    private async waitForInit(): Promise<void> {
        if (this.isInitialized) return;

        let attempts = 0;
        const maxAttempts = 50;
        const delay = 100;

        while (!this.isInitialized && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            attempts++;
        }

        if (!this.isInitialized) {
            this.isInitialized = true;
        }
    }

    private logDebug(message: string, ...args: any[]): void {
        if (this.DEBUG) {
        }
    }

    // ✅ THÊM MỚI: Methods cho uploaded files management
    /**
     * Lưu file đã upload vào storage
     */
    async saveUploadedFile(file: File, imageBase64: string): Promise<string> {
        await this.waitForInit();
        const fileId = `upload_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
        const now = new Date().toISOString();

        const uploadedFile: UploadedFile = {
            id: fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            imageBase64: imageBase64,
            timestamp: now,
            lastUsed: now,
            usageCount: 0,
        };

        try {
            await this.waitForLock();
            this.operationLock = true;

            if (this.db && this.db.objectStoreNames.contains("uploadedFiles")) {
                try {
                    const tx = this.db.transaction(
                        "uploadedFiles",
                        "readwrite"
                    );
                    const store = tx.objectStore("uploadedFiles");
                    await new Promise<void>((resolve, reject) => {
                        const request = store.put(uploadedFile);
                        request.onsuccess = () => {
                            resolve();
                        };
                        request.onerror = () => {
                            reject(request.error);
                        };
                    });
                } catch (indexedDBError) {
                    const existingFiles = this.getLocalStorageFiles();
                    existingFiles[fileId] = uploadedFile;
                    localStorage.setItem(
                        "uploaded_files",
                        JSON.stringify(existingFiles)
                    );
                    console.log(
                        "🔍 Saved to localStorage fallback, total files:",
                        Object.keys(existingFiles).length
                    );
                }
            } else {
                console.log("🔍 Using localStorage to save file");
                // Use localStorage with quota management
                const existingFiles = this.getLocalStorageFiles();

                // ✅ THÊM MỚI: Check storage quota before saving
                try {
                    existingFiles[fileId] = uploadedFile;
                    const dataToSave = JSON.stringify(existingFiles);

                    // Check if data size is reasonable (< 4MB to leave room for other data)
                    const sizeInMB =
                        new Blob([dataToSave]).size / (1024 * 1024);

                    if (sizeInMB > 4) {
                        console.warn(
                            `⚠️ Storage size (${sizeInMB.toFixed(
                                2
                            )}MB) approaching limit, cleaning old files...`
                        );
                        await this.cleanOldFiles(
                            existingFiles,
                            fileId,
                            uploadedFile
                        );
                    } else {
                        localStorage.setItem("uploaded_files", dataToSave);
                        console.log(
                            `✅ Saved to localStorage (${sizeInMB.toFixed(
                                2
                            )}MB), total files:`,
                            Object.keys(existingFiles).length
                        );
                    }
                } catch (error) {
                    if (
                        error instanceof DOMException &&
                        error.name === "QuotaExceededError"
                    ) {
                        console.warn(
                            "🚨 Storage quota exceeded, cleaning old files..."
                        );
                        await this.cleanOldFiles(
                            existingFiles,
                            fileId,
                            uploadedFile
                        );
                    } else {
                        throw error;
                    }
                }
            }

            this.logDebug(`✅ Saved uploaded file: ${file.name}`);
            return fileId;
        } catch (error) {
            console.error("❌ Error saving uploaded file:", error);
            throw error;
        } finally {
            this.operationLock = false;
            this.processQueue();
        }
    }

    // ✅ THÊM MỚI: Clean old files to free up storage space
    private async cleanOldFiles(
        existingFiles: any,
        newFileId: string,
        newFile: UploadedFile
    ): Promise<void> {
        console.log("🧹 Starting storage cleanup...");

        // Sort files by timestamp (oldest first)
        const fileEntries = Object.entries(existingFiles) as [
            string,
            UploadedFile
        ][];
        const sortedFiles = fileEntries.sort(
            (a, b) =>
                new Date(a[1].timestamp).getTime() -
                new Date(b[1].timestamp).getTime()
        );

        // Remove oldest files until we have space
        let cleanedFiles = { ...existingFiles };
        const maxFilesToKeep = Math.max(
            10,
            Math.floor(sortedFiles.length * 0.7)
        ); // Keep at least 70% or 10 files

        // Remove oldest files
        for (let i = 0; i < sortedFiles.length - maxFilesToKeep; i++) {
            const [fileId] = sortedFiles[i];
            delete cleanedFiles[fileId];
            console.log(`🗑️ Removed old file: ${fileId}`);
        }

        // Add the new file
        cleanedFiles[newFileId] = newFile;

        try {
            const dataToSave = JSON.stringify(cleanedFiles);
            localStorage.setItem("uploaded_files", dataToSave);

            const sizeInMB = new Blob([dataToSave]).size / (1024 * 1024);
            console.log(
                `✅ Storage cleaned, size: ${sizeInMB.toFixed(2)}MB, files: ${
                    Object.keys(cleanedFiles).length
                }`
            );
        } catch (error) {
            // If still too big, be more aggressive
            if (
                error instanceof DOMException &&
                error.name === "QuotaExceededError"
            ) {
                console.warn("🚨 Still too big, aggressive cleanup...");

                // Keep only newest 5 files plus the new one
                const newestFiles = sortedFiles.slice(-5);
                const aggressiveCleanedFiles: any = {};

                newestFiles.forEach(([fileId, file]) => {
                    aggressiveCleanedFiles[fileId] = file;
                });
                aggressiveCleanedFiles[newFileId] = newFile;

                localStorage.setItem(
                    "uploaded_files",
                    JSON.stringify(aggressiveCleanedFiles)
                );
                const finalSize =
                    new Blob([JSON.stringify(aggressiveCleanedFiles)]).size /
                    (1024 * 1024);
                console.log(
                    `✅ Aggressive cleanup complete, size: ${finalSize.toFixed(
                        2
                    )}MB, files: ${Object.keys(aggressiveCleanedFiles).length}`
                );
            } else {
                throw error;
            }
        }
    }

    /**
     * Lấy tất cả uploaded files
     */
    async getAllUploadedFiles(): Promise<UploadedFile[]> {
        await this.waitForInit();
        console.log("🔍 Getting all uploaded files, DB available:", !!this.db);

        try {
            await this.waitForLock();
            this.operationLock = true;

            // ✅ SỬA LỖI: Kiểm tra database và object store có tồn tại không
            if (this.db && this.db.objectStoreNames.contains("uploadedFiles")) {
                try {
                    console.log("🔍 Using IndexedDB to get files");
                    const tx = this.db.transaction("uploadedFiles", "readonly");
                    const store = tx.objectStore("uploadedFiles");

                    const files = await new Promise<UploadedFile[]>(
                        (resolve, reject) => {
                            const request = store.getAll();
                            request.onsuccess = () => {
                                console.log(
                                    "🔍 IndexedDB files result:",
                                    request.result
                                );
                                resolve(request.result);
                            };
                            request.onerror = () => {
                                console.error(
                                    "❌ IndexedDB getAll error:",
                                    request.error
                                );
                                reject(request.error);
                            };
                        }
                    );

                    // Sắp xếp theo lastUsed giảm dần
                    return files.sort(
                        (a, b) =>
                            new Date(b.lastUsed || b.timestamp).getTime() -
                            new Date(a.lastUsed || a.timestamp).getTime()
                    );
                } catch (indexedDBError) {
                    console.warn(
                        "❌ IndexedDB getAll failed, falling back to localStorage:",
                        indexedDBError
                    );
                    // Fallback to localStorage
                    const files = this.getLocalStorageFiles();
                    const fileArray = Object.values(files);
                    console.log("🔍 localStorage fallback files:", fileArray);
                    return fileArray.sort(
                        (a, b) =>
                            new Date(b.lastUsed || b.timestamp).getTime() -
                            new Date(a.lastUsed || a.timestamp).getTime()
                    );
                }
            } else {
                console.log("🔍 Using localStorage to get files");
                // Use localStorage
                const files = this.getLocalStorageFiles();
                const fileArray = Object.values(files);
                console.log(
                    "🔍 localStorage files result:",
                    fileArray.length,
                    "files"
                );
                return fileArray.sort(
                    (a, b) =>
                        new Date(b.lastUsed || b.timestamp).getTime() -
                        new Date(a.lastUsed || a.timestamp).getTime()
                );
            }
        } catch (error) {
            console.error("❌ Error getting uploaded files:", error);
            return [];
        } finally {
            this.operationLock = false;
            this.processQueue();
        }
    }

    /**
     * Cập nhật thông tin sử dụng file
     */
    async updateFileUsage(fileId: string): Promise<void> {
        await this.waitForInit();

        try {
            await this.waitForLock();
            this.operationLock = true;

            // ✅ SỬA LỖI: Kiểm tra database và object store có tồn tại không
            if (this.db && this.db.objectStoreNames.contains("uploadedFiles")) {
                try {
                    const tx = this.db.transaction(
                        "uploadedFiles",
                        "readwrite"
                    );
                    const store = tx.objectStore("uploadedFiles");

                    const file = await new Promise<UploadedFile | undefined>(
                        (resolve, reject) => {
                            const request = store.get(fileId);
                            request.onsuccess = () => resolve(request.result);
                            request.onerror = () => {
                                console.error(
                                    "❌ IndexedDB get error:",
                                    request.error
                                );
                                reject(request.error);
                            };
                        }
                    );

                    if (file) {
                        file.lastUsed = new Date().toISOString();
                        file.usageCount = (file.usageCount || 0) + 1;

                        await new Promise<void>((resolve, reject) => {
                            const request = store.put(file);
                            request.onsuccess = () => {
                                console.log(
                                    `✅ Updated usage for file: ${fileId}`
                                );
                                resolve();
                            };
                            request.onerror = () => {
                                console.error(
                                    "❌ IndexedDB put error:",
                                    request.error
                                );
                                reject(request.error);
                            };
                        });
                    }
                } catch (indexedDBError) {
                    console.warn(
                        "❌ IndexedDB update failed, falling back to localStorage:",
                        indexedDBError
                    );
                    // Fallback to localStorage
                    const files = this.getLocalStorageFiles();
                    if (files[fileId]) {
                        files[fileId].lastUsed = new Date().toISOString();
                        files[fileId].usageCount =
                            (files[fileId].usageCount || 0) + 1;
                        localStorage.setItem(
                            "uploaded_files",
                            JSON.stringify(files)
                        );
                        console.log(
                            `✅ Updated usage in localStorage for file: ${fileId}`
                        );
                    }
                }
            } else {
                // Use localStorage
                console.log("🔍 Using localStorage for usage update");
                const files = this.getLocalStorageFiles();
                if (files[fileId]) {
                    files[fileId].lastUsed = new Date().toISOString();
                    files[fileId].usageCount =
                        (files[fileId].usageCount || 0) + 1;
                    localStorage.setItem(
                        "uploaded_files",
                        JSON.stringify(files)
                    );
                    console.log(
                        `✅ Updated usage in localStorage for file: ${fileId}`
                    );
                }
            }
        } catch (error) {
            console.error("❌ Error updating file usage:", error);
        } finally {
            this.operationLock = false;
            this.processQueue();
        }
    }

    /**
     * Xóa uploaded file
     */
    async deleteUploadedFile(fileId: string): Promise<void> {
        await this.waitForInit();

        try {
            await this.waitForLock();
            this.operationLock = true;

            // ✅ SỬA LỖI: Kiểm tra database và object store có tồn tại không
            if (this.db && this.db.objectStoreNames.contains("uploadedFiles")) {
                try {
                    const tx = this.db.transaction(
                        "uploadedFiles",
                        "readwrite"
                    );
                    const store = tx.objectStore("uploadedFiles");

                    await new Promise<void>((resolve, reject) => {
                        const request = store.delete(fileId);
                        request.onsuccess = () => {
                            console.log(`✅ Deleted from IndexedDB: ${fileId}`);
                            resolve();
                        };
                        request.onerror = () => {
                            console.error(
                                "❌ IndexedDB delete error:",
                                request.error
                            );
                            reject(request.error);
                        };
                    });
                } catch (indexedDBError) {
                    console.warn(
                        "❌ IndexedDB delete failed, falling back to localStorage:",
                        indexedDBError
                    );
                    // Fallback to localStorage if IndexedDB fails
                    const files = this.getLocalStorageFiles();
                    delete files[fileId];
                    localStorage.setItem(
                        "uploaded_files",
                        JSON.stringify(files)
                    );
                }
            } else {
                // Use localStorage
                console.log("🔍 Using localStorage for delete operation");
                const files = this.getLocalStorageFiles();
                delete files[fileId];
                localStorage.setItem("uploaded_files", JSON.stringify(files));
            }

            this.logDebug(`✅ Deleted uploaded file: ${fileId}`);
        } catch (error) {
            console.error("❌ Error deleting uploaded file:", error);
            throw error;
        } finally {
            this.operationLock = false;
            this.processQueue();
        }
    }

    /**
     * Helper method để lấy files từ localStorage
     */
    private getLocalStorageFiles(): { [key: string]: UploadedFile } {
        try {
            const filesJson = localStorage.getItem("uploaded_files");
            return filesJson ? JSON.parse(filesJson) : {};
        } catch (error) {
            console.error("❌ Error reading localStorage files:", error);
            return {};
        }
    }

    /**
     * ✅ THÊM MỚI: Method để kiểm tra và tái tạo database nếu cần
     */
    async reinitializeDatabase(): Promise<void> {
        try {
            if (this.db) {
                this.db.close();
                this.db = null;
            }

            this.isInitialized = false;
            console.log("🔄 Reinitializing database...");

            await this.init();
            console.log("✅ Database reinitialized successfully");
        } catch (error) {
            console.error("❌ Error reinitializing database:", error);
            // Force to use localStorage
            this.isInitialized = true;
            this.db = null;
        }
    }

    /**
     * ✅ THÊM MỚI: Method để kiểm tra database health
     */
    async checkDatabaseHealth(): Promise<{
        indexedDBAvailable: boolean;
        uploadedFilesStoreExists: boolean;
        canPerformOperations: boolean;
        storageMethod: "indexeddb" | "localStorage";
    }> {
        await this.waitForInit();

        const health = {
            indexedDBAvailable: !!this.db,
            uploadedFilesStoreExists: false,
            canPerformOperations: false,
            storageMethod: "localStorage" as "indexeddb" | "localStorage",
        };

        if (this.db) {
            health.uploadedFilesStoreExists =
                this.db.objectStoreNames.contains("uploadedFiles");
            health.canPerformOperations = health.uploadedFilesStoreExists;

            if (health.canPerformOperations) {
                health.storageMethod = "indexeddb";
            }
        } else {
            // Check localStorage
            try {
                const testKey = "__test_storage__";
                localStorage.setItem(testKey, "test");
                localStorage.removeItem(testKey);
                health.canPerformOperations = true;
            } catch (error) {
                console.error("❌ localStorage test failed:", error);
            }
        }

        console.log("🔍 Database health check:", health);
        return health;
    }
}

/**
 * Lớp hỗ trợ nén ảnh
 */
class ImageCompressor {
    /**
     * Nén ảnh để giảm kích thước lưu trữ
     */
    static async compressImage(
        dataUrl: string,
        quality = 1.0,
        maxWidth = 1200
    ): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
        return new Promise((resolve, reject) => {
            try {
                // Bỏ qua nếu không phải data URL hợp lệ
                if (!dataUrl || !dataUrl.startsWith("data:")) {
                    throw new Error("Invalid data URL");
                }

                // Bỏ qua nếu là placeholder
                if (
                    dataUrl.includes(
                        "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM"
                    ) ||
                    dataUrl ===
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
                ) {
                    throw new Error("Placeholder image detected");
                }

                const img = new Image();
                img.onload = () => {
                    // Tạo canvas
                    const canvas = document.createElement("canvas");
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
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        throw new Error("Failed to get canvas context");
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    // Chuyển đổi sang blob
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(
                                    new Error(
                                        "Failed to create blob from canvas"
                                    )
                                );
                                return;
                            }

                            // Lấy cả data URL cho các trường hợp cần thiết
                            const compressedDataUrl = canvas.toDataURL(
                                "image/jpeg",
                                quality
                            );

                            resolve({
                                blob,
                                dataUrl: compressedDataUrl,
                                width,
                                height,
                            });
                        },
                        "image/jpeg",
                        quality
                    );
                };

                img.onerror = () => {
                    reject(new Error("Failed to load image for compression"));
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
    static async migrateFromOldLocalStorage(
        storageManager: StorageManager
    ): Promise<boolean> {
        try {
            // Kiểm tra nếu đã migrate
            if (localStorage.getItem("migration_completed") === "true") {
                return true;
            }

            // Lấy dữ liệu từ định dạng cũ
            const oldDataJson = localStorage.getItem(
                "Image_Generator_Sessions"
            );
            if (!oldDataJson) {
                localStorage.setItem("migration_completed", "true");
                return true;
            }

            const oldData = JSON.parse(oldDataJson);
            if (!Array.isArray(oldData) || oldData.length === 0) {
                localStorage.setItem("migration_completed", "true");
                return true;
            }

            // Deduplicate dữ liệu cũ trước
            const uniqueIds = new Set();
            const uniqueOldData = oldData.filter((session) => {
                if (!session.sessionId) return false;
                if (uniqueIds.has(session.sessionId)) return false;
                uniqueIds.add(session.sessionId);
                return true;
            });

            // Lưu từng session vào storage mới
            for (const session of uniqueOldData) {
                await storageManager.saveSession({
                    sessionId: session.sessionId,
                    describe: session.describe || "",
                    images: session.images || [],
                });
            }

            // Đánh dấu đã hoàn thành migration
            localStorage.setItem("migration_completed", "true");

            // Tạo backup dữ liệu cũ phòng khi cần
            localStorage.setItem(
                "Image_Generator_Sessions_BACKUP",
                oldDataJson
            );

            return true;
        } catch (error) {
            return false;
        }
    }
}

// Tạo singleton instance
const storageManager = new StorageManager();

// Export các lớp và singleton
export { ImageCompressor, StorageManager, storageManager, StorageMigration };

// ✅ THÊM MỚI: Export type UploadedFile
export type { UploadedFile };
