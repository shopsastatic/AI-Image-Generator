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

    // Lưu tabs vào localStorage
    const saveTabsToStorage = useCallback((tabsToSave: TabData[]) => {
        try {
            localStorage.setItem(
                "ai_generator_tabs",
                JSON.stringify(tabsToSave)
            );
        } catch (error) {
            console.error("❌ Error saving tabs to storage:", error);
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
        [onTabChange, saveTabsToStorage]
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
                            title: pageData.title,
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

    // Click outside để đóng context menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenu.visible) {
                closeContextMenu();
            }
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [contextMenu.visible, closeContextMenu]);

    if (!isVisible) return null;

    return (
        <div
            ref={sidebarRef}
            className={`tab-sidebar ${isCollapsed ? "collapsed" : ""}`}
        >
            {/* Header */}
            <div className="tab-sidebar-header">
                <div className="tab-sidebar-title">
                    <span>🗂️ Workspace Tabs</span>
                </div>

                <div className="tab-sidebar-controls">
                    <button
                        className="tab-control-btn"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed ? "→" : "←"}
                    </button>
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
                        // ✅ Hiển thị tabs như bình thường
                        tabs.map((tab) => (
                            <div
                                key={tab.id}
                                className={`tab-item ${
                                    tab.isActive ? "active" : ""
                                }`}
                                onClick={() => switchToTab(tab.id)}
                                onContextMenu={(e) =>
                                    handleRightClick(e, tab.id)
                                }
                            >
                                <div className="tab-thumbnail">
                                    {tab.thumbnail ? (
                                        <img
                                            src={tab.thumbnail}
                                            alt={tab.title}
                                        />
                                    ) : (
                                        <div className="tab-thumbnail-placeholder">
                                            📄
                                        </div>
                                    )}
                                </div>

                                <div className="tab-info">
                                    <div
                                        className="tab-title"
                                        title={tab.title}
                                    >
                                        {tab.title}
                                    </div>
                                    <div className="tab-meta">
                                        <span className="tab-timestamp">
                                            {new Date(
                                                tab.timestamp
                                            ).toLocaleTimeString("vi-VN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                        {tab.history.length > 0 && (
                                            <span className="tab-history-count">
                                                {tab.history.length} items
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    className="tab-close-btn"
                                    onClick={(e) => closeTab(tab.id, e)}
                                    title="Close tab"
                                >
                                    ×
                                </button>
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
