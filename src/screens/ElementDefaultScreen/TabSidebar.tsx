import React, { useCallback, useEffect, useRef, useState } from "react";
import "./TabSidebar.css";

export interface TabWorkspaceData {
    // Image generation data
    selectedImages: Array<{
        imageUrl: string;
        clickedAt: number;
        prompt?: string;
        platform?: string;
        claudeResponse?: string;
        size?: string;
        quality?: string;
        sessionId?: string;
        imageIndex?: number;
    }>;

    // Loading sessions
    loadingSessions: Array<{
        sessionId: string;
        prompt: string;
        platform: string;
        startTime: number;
        jobId: string | null;
        countdown: number;
    }>;

    // Current prompt
    promptText: string;

    // Uploaded images
    uploadedImages: string[];

    // Selected sessions data
    selectedSessions: Array<{
        sessionId: string;
        clickedAt: number;
        currentImageIndex: number;
        describe?: string;
        list: Array<{
            imageBase64: string;
            prompt: string;
            platform: string;
            claudeResponse?: string;
            timestamp: string;
            size: string;
            quality: string;
            AdCreativeA?: string;
            AdCreativeB?: string;
        }>;
    }>;

    // UI state
    uiState: {
        showImageInfo: boolean;
        activeDropdown: string | null;
        activeSession: string | null;
        selectedImageSize: {
            width: number;
            height: number;
            platform: string;
        };
    };
}

// ✅ Export default workspace data creator
export const createDefaultWorkspaceData = (): TabWorkspaceData => ({
    selectedImages: [],
    loadingSessions: [],
    promptText: "",
    uploadedImages: [],
    selectedSessions: [],
    uiState: {
        showImageInfo: false,
        activeDropdown: null,
        activeSession: null,
        selectedImageSize: {
            width: 1024,
            height: 1024,
            platform: "openai",
        },
    },
});

interface TabData {
    id: string;
    title: string;
    thumbnail?: string;
    timestamp: string;
    isActive: boolean;
    isPinned: boolean; // ✅ THÊM MỚI: Pin state
    isCustomTitle?: boolean; // ✅ THÊM MỚI: Track if user renamed this tab
    lastActiveAt?: number; // ✅ THÊM MỚI: Track last active time for cleanup
    history: TabHistoryItem[];
    currentPage: string;
    workspaceData: TabWorkspaceData; // ✅ THÊM MỚI: Workspace data cho mỗi tab
}

interface TabHistoryItem {
    id: string;
    title: string;
    url: string;
    timestamp: string;
    thumbnail?: string;
}

interface TabSidebarProps {
    isVisible: boolean;
    onTabChange: (tabId: string, workspaceData: TabWorkspaceData) => void; // ✅ CẬP NHẬT: Pass workspace data
    onTabWorkspaceUpdate: (
        tabId: string,
        workspaceData: TabWorkspaceData
    ) => void; // ✅ THÊM MỚI: Update workspace
    currentPageData?: {
        title: string;
        thumbnail?: string;
        url: string;
    };
    currentWorkspaceData: TabWorkspaceData; // ✅ THÊM MỚI: Current workspace data
}

const TabSidebar: React.FC<TabSidebarProps> = ({
    isVisible,
    onTabChange,
    onTabWorkspaceUpdate,
    currentPageData,
    currentWorkspaceData,
}) => {
    const [tabs, setTabs] = useState<TabData[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [editingTabId, setEditingTabId] = useState<string | null>(null); // ✅ THÊM MỚI: Tab đang rename
    const [editingTabName, setEditingTabName] = useState<string>(""); // ✅ THÊM MỚI: Tên đang edit
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        tabId: string;
    }>({ visible: false, x: 0, y: 0, tabId: "" });
    const sidebarRef = useRef<HTMLDivElement>(null);

    // ✅ THÊM MỚI: Update workspace data cho active tab
    const updateActiveTabWorkspace = useCallback(() => {
        if (!activeTabId) return;

        setTabs((prevTabs) => {
            const updatedTabs = prevTabs.map((tab) => {
                if (tab.id === activeTabId) {
                    return {
                        ...tab,
                        workspaceData: currentWorkspaceData,
                        timestamp: new Date().toISOString(),
                    };
                }
                return tab;
            });
            saveTabsToStorage(updatedTabs);
            return updatedTabs;
        });
    }, [activeTabId, currentWorkspaceData]);

    // ✅ THÊM MỚI: Auto-save workspace data cho active tab
    useEffect(() => {
        updateActiveTabWorkspace();
    }, [updateActiveTabWorkspace]);

    // Khởi tạo tabs từ storage khi component mount
    useEffect(() => {
        loadTabsFromStorage();
    }, []);

    // ❌ REMOVED: Không tự động tạo tab - chỉ tạo khi người dùng click
    // useEffect(() => {
    //     if (tabs.length === 0) {
    //         createNewTab("Home", "Main workspace for AI Image Generator");
    //     }
    // }, [tabs.length]);

    // Cập nhật tab hiện tại khi có dữ liệu page mới
    useEffect(() => {
        if (currentPageData && activeTabId) {
            updateCurrentTab(currentPageData);
        }
    }, [currentPageData, activeTabId]);

    // Load tabs từ localStorage
    const loadTabsFromStorage = async () => {
        try {
            const savedTabs = localStorage.getItem("ai_generator_tabs");
            if (savedTabs) {
                const parsedTabs: TabData[] = JSON.parse(savedTabs);
                setTabs(parsedTabs);

                // Chỉ tìm và set active tab nếu có tabs
                if (parsedTabs.length > 0) {
                    const activeTab =
                        parsedTabs.find((tab) => tab.isActive) || parsedTabs[0];
                    if (activeTab) {
                        setActiveTabId(activeTab.id);

                        // ✅ THÊM MỚI: Gọi onTabChange để load workspace data
                        if (activeTab.workspaceData) {
                            onTabChange(activeTab.id, activeTab.workspaceData);
                        } else {
                            // Nếu tab cũ không có workspace data, tạo mặc định
                            const defaultWorkspace =
                                createDefaultWorkspaceData();
                            onTabChange(activeTab.id, defaultWorkspace);
                        }
                    }
                }
            }
            // ✅ Không tạo tab mặc định - để người dùng tự tạo
        } catch (error) {
            console.error("❌ Error loading tabs from storage:", error);
        }
    };

    // Lưu tabs vào localStorage với quota management
    const saveTabsToStorage = useCallback((tabsToSave: TabData[]) => {
        try {
            const dataToSave = JSON.stringify(tabsToSave);
            const sizeInMB = new Blob([dataToSave]).size / (1024 * 1024);

            // Check if tabs data is too large (> 2MB)
            if (sizeInMB > 2) {
                console.warn(
                    `⚠️ Tabs data size (${sizeInMB.toFixed(
                        2
                    )}MB) is large, cleaning workspace data...`
                );

                // Clean workspace data from tabs to reduce size
                const cleanedTabs = tabsToSave.map((tab) => ({
                    ...tab,
                    workspaceData: {
                        ...tab.workspaceData,
                        // Keep only essential data, remove large images
                        selectedImages:
                            tab.workspaceData.selectedImages?.slice(0, 3) || [], // Keep only 3 newest images
                        uploadedImages:
                            tab.workspaceData.uploadedImages?.slice(0, 2) || [], // Keep only 2 newest uploaded images
                    },
                }));

                const cleanedDataSize =
                    new Blob([JSON.stringify(cleanedTabs)]).size /
                    (1024 * 1024);
                console.log(
                    `🧹 Cleaned tabs data from ${sizeInMB.toFixed(
                        2
                    )}MB to ${cleanedDataSize.toFixed(2)}MB`
                );

                localStorage.setItem(
                    "ai_generator_tabs",
                    JSON.stringify(cleanedTabs)
                );
            } else {
                localStorage.setItem("ai_generator_tabs", dataToSave);
            }
        } catch (error) {
            if (
                error instanceof DOMException &&
                error.name === "QuotaExceededError"
            ) {
                console.warn(
                    "🚨 Storage quota exceeded for tabs, aggressive cleanup..."
                );

                // Keep only pinned tabs and last 3 active tabs
                const pinnedTabs = tabsToSave.filter((tab) => tab.isPinned);
                const recentTabs = tabsToSave
                    .filter((tab) => !tab.isPinned)
                    .sort(
                        (a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0)
                    )
                    .slice(0, 3);

                const essentialTabs = [...pinnedTabs, ...recentTabs].map(
                    (tab) => ({
                        ...tab,
                        workspaceData: {
                            selectedImages: [],
                            loadingSessions: [],
                            promptText: tab.workspaceData.promptText || "",
                            uploadedImages: [],
                            selectedSessions: [],
                            uiState: tab.workspaceData.uiState || {},
                        },
                    })
                );

                try {
                    localStorage.setItem(
                        "ai_generator_tabs",
                        JSON.stringify(essentialTabs)
                    );
                    console.log(
                        `✅ Aggressive cleanup: kept ${essentialTabs.length} essential tabs`
                    );
                } catch (finalError) {
                    console.error(
                        "❌ Critical storage error, clearing all tabs:",
                        finalError
                    );
                    localStorage.removeItem("ai_generator_tabs");
                }
            } else {
                console.error("❌ Error saving tabs to storage:", error);
            }
        }
    }, []);

    // Tạo tab mới
    const createNewTab = useCallback(
        (title: string = "New Tab", url: string = "/") => {
            const newTab: TabData = {
                id: `tab_${Date.now()}_${Math.random()
                    .toString(36)
                    .substr(2, 9)}`,
                title,
                thumbnail: generateDefaultThumbnail(title),
                timestamp: new Date().toISOString(),
                isActive: false,
                isPinned: false, // ✅ THÊM MỚI: Default not pinned
                isCustomTitle: false, // ✅ THÊM MỚI: Default not custom title
                lastActiveAt: Date.now(), // ✅ THÊM MỚI: Track creation time
                history: [],
                currentPage: url,
                workspaceData: createDefaultWorkspaceData(), // ✅ THÊM MỚI: Default workspace data
            };

            setTabs((prevTabs) => {
                // Deactivate tất cả tabs khác
                const updatedTabs = prevTabs.map((tab) => ({
                    ...tab,
                    isActive: false,
                }));
                newTab.isActive = true;
                const newTabs = [...updatedTabs, newTab];
                saveTabsToStorage(newTabs);
                return newTabs;
            });

            setActiveTabId(newTab.id);
            onTabChange(newTab.id, newTab.workspaceData); // ✅ CẬP NHẬT: Pass workspace data
        },
        [onTabChange, saveTabsToStorage]
    );

    // Tạo thumbnail mặc định
    const generateDefaultThumbnail = (title: string): string => {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 150;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, 200, 150);
            gradient.addColorStop(0, "#667eea");
            gradient.addColorStop(1, "#764ba2");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 200, 150);

            // Text
            ctx.fillStyle = "white";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.fillText(title.substring(0, 10), 100, 80);
        }

        return canvas.toDataURL();
    };

    // Chuyển đổi tab
    const switchToTab = useCallback(
        (tabId: string) => {
            const targetTab = tabs.find((tab) => tab.id === tabId);
            if (!targetTab) return;

            setTabs((prevTabs) => {
                const updatedTabs = prevTabs.map((tab) => ({
                    ...tab,
                    isActive: tab.id === tabId,
                    lastActiveAt:
                        tab.id === tabId ? Date.now() : tab.lastActiveAt, // ✅ Track last active time
                }));
                saveTabsToStorage(updatedTabs);
                return updatedTabs;
            });

            setActiveTabId(tabId);
            onTabChange(tabId, targetTab.workspaceData); // ✅ CẬP NHẬT: Pass workspace data
        },
        [onTabChange, saveTabsToStorage, tabs]
    );

    // Đóng tab
    const closeTab = useCallback(
        (tabId: string, event?: React.MouseEvent) => {
            if (event) {
                event.stopPropagation();
            }

            // ✅ THÊM MỚI: Không cho phép đóng pinned tabs
            const tab = tabs.find((t) => t.id === tabId);
            if (tab && tab.isPinned) {
                return; // Không làm gì nếu tab được pin
            }

            const isDel = confirm("Bạn chắc chắn muốn xóa?");
            if (!isDel) return;

            setTabs((prevTabs) => {
                const tabIndex = prevTabs.findIndex((tab) => tab.id === tabId);
                if (tabIndex === -1) return prevTabs;

                const updatedTabs = prevTabs.filter((tab) => tab.id !== tabId);

                // Nếu đóng tab active, chuyển sang tab khác
                if (prevTabs[tabIndex].isActive && updatedTabs.length > 0) {
                    const newActiveIndex = Math.min(
                        tabIndex,
                        updatedTabs.length - 1
                    );
                    updatedTabs[newActiveIndex].isActive = true;
                    setActiveTabId(updatedTabs[newActiveIndex].id);
                    onTabChange(
                        updatedTabs[newActiveIndex].id,
                        updatedTabs[newActiveIndex].workspaceData
                    ); // ✅ CẬP NHẬT: Pass workspace data
                } else if (updatedTabs.length === 0) {
                    setActiveTabId(null);
                }

                saveTabsToStorage(updatedTabs);
                return updatedTabs;
            });
        },
        [onTabChange, saveTabsToStorage, tabs]
    );

    // Cập nhật tab hiện tại với dữ liệu mới
    const updateCurrentTab = useCallback(
        (pageData: { title: string; thumbnail?: string; url: string }) => {
            if (!activeTabId) return;

            setTabs((prevTabs) => {
                const updatedTabs = prevTabs.map((tab) => {
                    if (tab.id === activeTabId) {
                        // Thêm vào history nếu URL khác
                        const newHistory = [...tab.history];
                        if (tab.currentPage !== pageData.url) {
                            newHistory.push({
                                id: `history_${Date.now()}`,
                                title: tab.title,
                                url: tab.currentPage,
                                timestamp: new Date().toISOString(),
                                thumbnail: tab.thumbnail,
                            });

                            // Giới hạn history (chỉ giữ 20 items gần nhất)
                            if (newHistory.length > 20) {
                                newHistory.shift();
                            }
                        }

                        return {
                            ...tab,
                            // ✅ FIXED: Chỉ update title nếu user chưa rename tab
                            title: tab.isCustomTitle
                                ? tab.title
                                : pageData.title,
                            thumbnail: pageData.thumbnail || tab.thumbnail,
                            currentPage: pageData.url,
                            history: newHistory,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    return tab;
                });

                saveTabsToStorage(updatedTabs);
                return updatedTabs;
            });
        },
        [activeTabId, saveTabsToStorage]
    );

    // Xử lý context menu
    const handleRightClick = useCallback(
        (event: React.MouseEvent, tabId: string) => {
            event.preventDefault();
            setContextMenu({
                visible: true,
                x: event.clientX,
                y: event.clientY,
                tabId,
            });
        },
        []
    );

    // Đóng context menu
    const closeContextMenu = useCallback(() => {
        setContextMenu((prev) => ({ ...prev, visible: false }));
    }, []);

    // Duplicate tab
    const duplicateTab = useCallback(
        (tabId: string) => {
            const originalTab = tabs.find((tab) => tab.id === tabId);
            if (originalTab) {
                createNewTab(
                    `${originalTab.title} (Copy)`,
                    originalTab.currentPage
                );
            }
            closeContextMenu();
        },
        [tabs, createNewTab, closeContextMenu]
    );

    // Close other tabs
    const closeOtherTabs = useCallback(
        (keepTabId: string) => {
            const isDel = confirm(
                "Bạn chắc chắn muốn xóa hết? hành động này không thể thu hồi"
            );
            if (!isDel) return;

            setTabs((prevTabs) => {
                const updatedTabs = prevTabs.filter(
                    (tab) => tab.id === keepTabId
                );
                saveTabsToStorage(updatedTabs);
                return updatedTabs;
            });
            closeContextMenu();
        },
        [saveTabsToStorage, closeContextMenu]
    );

    // ✅ THÊM MỚI: Pin/Unpin tab
    const togglePinTab = useCallback(
        (tabId: string) => {
            setTabs((prevTabs) => {
                const updatedTabs = prevTabs.map((tab) => {
                    if (tab.id === tabId) {
                        return { ...tab, isPinned: !tab.isPinned };
                    }
                    return tab;
                });
                saveTabsToStorage(updatedTabs);
                return updatedTabs;
            });
            closeContextMenu();
        },
        [saveTabsToStorage, closeContextMenu]
    );

    // ✅ THÊM MỚI: Start rename tab
    const startRenameTab = useCallback(
        (tabId: string) => {
            const tab = tabs.find((t) => t.id === tabId);
            if (tab) {
                setEditingTabId(tabId);
                setEditingTabName(tab.title);
                closeContextMenu();
            }
        },
        [tabs, closeContextMenu]
    );

    // ✅ THÊM MỚI: Save rename tab
    const saveRenameTab = useCallback(
        (tabId: string, newName: string) => {
            if (newName.trim() === "") return;

            console.log(`🏷️ Renaming tab ${tabId} to: "${newName.trim()}"`);

            setTabs((prevTabs) => {
                const updatedTabs = prevTabs.map((tab) => {
                    if (tab.id === tabId) {
                        return {
                            ...tab,
                            title: newName.trim(),
                            isCustomTitle: true, // ✅ THÊM MỚI: Mark tab as user-renamed
                            timestamp: new Date().toISOString(), // ✅ Update timestamp khi rename
                        };
                    }
                    return tab;
                });

                // ✅ THÊM MỚI: Đảm bảo lưu vào localStorage ngay lập tức
                try {
                    saveTabsToStorage(updatedTabs);
                    console.log(
                        `✅ Tab renamed and saved to localStorage successfully`
                    );
                } catch (error) {
                    console.error("❌ Error saving renamed tab:", error);
                }

                return updatedTabs;
            });

            setEditingTabId(null);
            setEditingTabName("");

            // ✅ THÊM MỚI: Verify lưu thành công bằng cách đọc lại từ localStorage
            setTimeout(() => {
                try {
                    const savedTabs = localStorage.getItem("ai_generator_tabs");
                    if (savedTabs) {
                        const parsedTabs = JSON.parse(savedTabs);
                        const renamedTab = parsedTabs.find(
                            (t: TabData) => t.id === tabId
                        );
                        if (renamedTab && renamedTab.title === newName.trim()) {
                            console.log(
                                `✅ Verified: Tab rename saved to localStorage`
                            );

                            // ✅ THÊM MỚI: Show success notification
                            const notification = document.createElement("div");
                            notification.textContent = `📝 Tab renamed to "${newName.trim()}"`;
                            notification.className = "tab-rename-notification";
                            notification.style.cssText = `
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                background: rgba(40, 167, 69, 0.95);
                                color: white;
                                padding: 12px 16px;
                                border-radius: 8px;
                                font-size: 13px;
                                z-index: 10000;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            `;
                            document.body.appendChild(notification);
                            setTimeout(() => {
                                if (notification.parentNode) {
                                    notification.parentNode.removeChild(
                                        notification
                                    );
                                }
                            }, 2000);
                        } else {
                            console.warn(
                                `⚠️ Tab rename may not have been saved properly`
                            );
                        }
                    }
                } catch (error) {
                    console.error("❌ Error verifying tab rename save:", error);
                }
            }, 100); // Delay nhỏ để đảm bảo localStorage đã được cập nhật
        },
        [saveTabsToStorage]
    );

    // ✅ THÊM MỚI: Force refresh localStorage để đảm bảo tính nhất quán
    const forceRefreshTabsFromStorage = useCallback(() => {
        try {
            const savedTabs = localStorage.getItem("ai_generator_tabs");
            if (savedTabs) {
                const parsedTabs: TabData[] = JSON.parse(savedTabs);
                setTabs(parsedTabs);
                console.log("🔄 Force refreshed tabs from localStorage");
            }
        } catch (error) {
            console.error("❌ Error force refreshing tabs:", error);
        }
    }, []);

    // ✅ THÊM MỚI: Cancel rename
    const cancelRename = useCallback(() => {
        setEditingTabId(null);
        setEditingTabName("");
    }, []);

    // ✅ THÊM MỚI: Handle double click to rename với prompt
    const handleDoubleClick = useCallback(
        (tabId: string) => {
            const tab = tabs.find((t) => t.id === tabId);
            if (!tab) return;

            const newName = prompt("Enter new tab name:", tab.title);

            if (
                newName !== null &&
                newName.trim() !== "" &&
                newName.trim() !== tab.title
            ) {
                console.log(`🏷️ Renaming tab ${tabId} to: "${newName.trim()}"`);

                setTabs((prevTabs) => {
                    const updatedTabs = prevTabs.map((t) => {
                        if (t.id === tabId) {
                            return {
                                ...t,
                                title: newName.trim(),
                                isCustomTitle: true, // Mark as user-renamed
                            };
                        }
                        return t;
                    });
                    saveTabsToStorage(updatedTabs);
                    return updatedTabs;
                });
            }
        },
        [tabs]
    );

    // Click outside để đóng context menu và handle keyboard shortcuts
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu.visible) {
                closeContextMenu();
            }
        };

        // ✅ THÊM MỚI: Keyboard shortcuts
        const handleKeyPress = (event: KeyboardEvent) => {
            // F2 để rename active tab
            if (event.key === "F2" && activeTabId && !editingTabId) {
                event.preventDefault();
                startRenameTab(activeTabId);
            }

            // Escape để cancel rename
            if (event.key === "Escape" && editingTabId) {
                event.preventDefault();
                cancelRename();
            }
        };

        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeyPress);

        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleKeyPress);
        };
    }, [
        contextMenu.visible,
        closeContextMenu,
        activeTabId,
        editingTabId,
        startRenameTab,
        cancelRename,
    ]);

    if (!isVisible) return null;

    return (
        <div
            ref={sidebarRef}
            className={`tab-sidebar ${isCollapsed ? "collapsed" : ""}`}
        >
            {/* Header */}
            <div className="tab-sidebar-header">
                <div className="tab-sidebar-controls">
                    <button
                        className="tab-control-btn"
                        onClick={() => createNewTab()}
                        title="New Tab"
                    >
                        +
                    </button>
                </div>
            </div>
            <div
                style={{
                    height: "1px",
                    background: "#ccc",
                }}
            />

            {/* Tabs List */}
            {!isCollapsed && (
                <div className="tabs-container">
                    {tabs.length === 0 ? (
                        // ✅ Empty state - chỉ hiển thị khi không có tab
                        <div className="empty-tabs-state">
                            <div className="empty-icon">📁</div>
                            <div className="empty-message">No tabs yet</div>
                            <button
                                className="create-first-tab-btn"
                                onClick={() => createNewTab("Home", "/")}
                                title="Create your first tab"
                            >
                                Create First Tab
                            </button>
                        </div>
                    ) : (
                        // ✅ Hiển thị tabs với pinned tabs lên đầu
                        [...tabs]
                            .sort((a, b) => {
                                // Pinned tabs lên đầu
                                if (a.isPinned && !b.isPinned) return -1;
                                if (!a.isPinned && b.isPinned) return 1;
                                return 0;
                            })
                            .map((tab) => (
                                <div
                                    data-tooltip-content={`${tab.title}`}
                                    data-tooltip-id="optimize-tooltip-sidebar"
                                    key={tab.id}
                                    className={`tab-item ${
                                        tab.isActive ? "active" : ""
                                    } ${tab.isPinned ? "pinned" : ""}`}
                                    onClick={() => switchToTab(tab.id)}
                                    onDoubleClick={() =>
                                        handleDoubleClick(tab.id)
                                    }
                                    onContextMenu={(e) =>
                                        handleRightClick(e, tab.id)
                                    }
                                >
                                    {tab.isPinned && (
                                        <div className="tab-pin-indicator">
                                            📌
                                        </div>
                                    )}
                                    <div className="tab-thumbnail">
                                        {tab.thumbnail ? (
                                            <img
                                                src="/img/svg-7.svg"
                                                alt={tab.title}
                                            />
                                        ) : (
                                            <div className="tab-thumbnail-placeholder">
                                                📄
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            )}

            {/* Tab History */}
            {!isCollapsed && activeTabId && (
                <div className="tab-history">
                    <div className="tab-history-header">
                        <span>📜 History</span>
                    </div>
                    <div className="tab-history-list">
                        {tabs
                            .find((tab) => tab.id === activeTabId)
                            ?.history.map((historyItem) => (
                                <div
                                    key={historyItem.id}
                                    className="history-item"
                                >
                                    <div className="history-thumbnail">
                                        {historyItem.thumbnail ? (
                                            <img
                                                src={historyItem.thumbnail}
                                                alt={historyItem.title}
                                            />
                                        ) : (
                                            <div className="history-thumbnail-placeholder">
                                                📄
                                            </div>
                                        )}
                                    </div>
                                    <div className="history-info">
                                        <div
                                            className="history-title"
                                            title={historyItem.title}
                                        >
                                            {historyItem.title}
                                        </div>
                                        <div className="history-timestamp">
                                            {new Date(
                                                historyItem.timestamp
                                            ).toLocaleString("vi-VN")}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    className="tab-context-menu"
                    style={{
                        position: "fixed",
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 10000,
                    }}
                >
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            handleDoubleClick(contextMenu.tabId);
                            closeContextMenu();
                        }}
                    >
                        ✏️ Rename Tab
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={() => togglePinTab(contextMenu.tabId)}
                    >
                        {tabs.find((t) => t.id === contextMenu.tabId)?.isPinned
                            ? "📌 Unpin Tab"
                            : "📌 Pin Tab"}
                    </div>
                    <div className="context-menu-separator"></div>
                    <div
                        className="context-menu-item"
                        onClick={() => duplicateTab(contextMenu.tabId)}
                    >
                        🔄 Duplicate Tab
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={() => closeOtherTabs(contextMenu.tabId)}
                    >
                        🗑️ Close Other Tabs
                    </div>
                    <div
                        className="context-menu-item danger"
                        onClick={() => closeTab(contextMenu.tabId)}
                    >
                        ❌ Close Tab
                    </div>
                </div>
            )}
        </div>
    );
};

export default TabSidebar;
