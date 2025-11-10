import React, { useState, useEffect, useCallback, useRef } from "react";
import { historyService } from "./historyService";
import { FixedSizeList as List } from "react-window";

interface HistoryImage {
  imageUrl: string;
  prompt: string;
  category?: string;
  subCategory?: string;
  platform?: string;
  AdCreativeA?: string;
  AdCreativeB?: string;
  timestamp: string;
}

interface HistoryItem {
  id: string;
  isSelected?: boolean;
  describe?: string;
  category?: string;
  subCategory?: string;
  platform?: string;
  list: HistoryImage[];
  thumbnail?: string;
  imageCount?: number;
  timestamp?: string;
}

interface HistorySidebarProps {
  isVisible: boolean;
  toggleSidebar: () => void;
  onItemClick: (item: any) => void;
  selectedImages: Array<{
    imageUrl: string;
    clickedAt: number;
    sessionId?: string;
  }>;
  onSelectAll?: (unselectedCount: number) => void;
  maxGridItems?: number;
  currentUser?: { email: string; role: string } | null;
}

const ClearHistoryOverlay: React.FC<{
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ onCancel, onConfirm }) => {
  return (
    <div className="clear-history-overlay">
      <div className="clear-overlay-body">
        <h4 className="clear-overlay-warning-title">
          This will refresh your history from the server.
        </h4>
        <p className="clear-overlay-description">
          Your image generation history is stored on our servers. This action
          will clear the local cache and reload the latest data from the server.
          Your history will not be deleted from the database.
        </p>
      </div>
      <div className="clear-overlay-footer">
        <button className="clear-overlay-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="clear-overlay-confirm-btn" onClick={onConfirm}>
          Refresh history
        </button>
      </div>
    </div>
  );
};

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isVisible,
  toggleSidebar,
  onItemClick,
  selectedImages,
  onSelectAll,
  currentUser,
}) => {
  const [allHistoryItems, setAllHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  // ✅ Multi-select role filter
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  const loadingRef = useRef<boolean>(false);
  const errorShownRef = useRef<boolean>(false);
  const listRef = useRef<any>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  // ✅ FIX: Close dropdown when click outside - ĐẶT NGOÀI loadHistoryData
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isFilterOpen]);

  // ✅ FIX: Fetch available roles - ĐẶT NGOÀI loadHistoryData
  useEffect(() => {
    const fetchRoles = async () => {
      if (currentUser?.role === "Admin") {
        try {
          const response = await fetch("/api/roles", {
            credentials: "include",
          });
          const data = await response.json();
          if (data.success) {
            // ✅ Include Admin role
            const roles = ["Admin", ...(data.roles || [])];
            setAvailableRoles(roles);
          }
        } catch (error) {
          console.error("Failed to fetch roles:", error);
        }
      }
    };

    fetchRoles();
  }, [currentUser]);

  // ✅ FIX: loadHistoryData với selectedRoles (array)
  const loadHistoryData = useCallback(async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);

    try {
      // ✅ FIX: Truyền selectedRoles (array) thay vì roleFilter (string)
      const sessions = await historyService.fetchHistory(
        currentUser?.role === "Admin" && selectedRoles.length > 0
          ? selectedRoles
          : undefined
      );

      if (sessions && sessions.length > 0) {
        console.log("✅ History loaded:", sessions.length, "sessions");

        const allItems: HistoryItem[] = sessions.map((session) => ({
          id: session.sessionId,
          describe: session.describe,
          category: session.category,
          subCategory: session.subCategory,
          platform: session.platform,
          list: session.images.map((img) => ({
            imageUrl: img.imageUrl,
            prompt: img.prompt,
            category: img.category,
            subCategory: img.subCategory,
            platform: img.platform,
            timestamp: img.timestamp,
            AdCreativeA: "",
            AdCreativeB: "",
          })),
          thumbnail: session.images[0]?.imageUrl || "",
          imageCount: session.images.length,
          timestamp: session.timestamp,
        }));

        setAllHistoryItems(allItems);
      } else {
        setAllHistoryItems([]);
      }
    } catch (error) {
      console.error("❌ Failed to load history:", error);
      setAllHistoryItems([]);

      if (!errorShownRef.current) {
        errorShownRef.current = true;
        showNotification(
          "error",
          "Failed to Load History",
          "Could not fetch history from server."
        );
      }
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [selectedRoles, currentUser]); // ✅ FIX: Dependencies

  // ✅ FIX: Load khi sidebar visible
  useEffect(() => {
    if (isVisible) {
      loadHistoryData();
    }
  }, [isVisible, loadHistoryData]);

  // ✅ FIX: Reload khi selectedRoles thay đổi
  useEffect(() => {
    if (isVisible) {
      loadHistoryData();
    }
  }, [selectedRoles]); // ✅ Chỉ cần selectedRoles

  // ✅ Toggle role selection
  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  // ✅ Clear all filters
  const clearFilters = () => {
    setSelectedRoles([]);
  };

  const isItemSelected = useCallback(
    (item: HistoryItem): boolean => {
      return selectedImages.some((img) => img.sessionId === item.id);
    },
    [selectedImages]
  );

  const hasUnselectedItems = allHistoryItems.some(
    (item) => !isItemSelected(item)
  );

  const handleItemClick = async (item: HistoryItem) => {
    {loadingItemId && (
      <div className="history-item-loading-overlay">
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading images...</p>
        </div>
      </div>
    )}

    {/* Existing loading overlay for refresh */}
    {isLoading && allHistoryItems.length > 0 && (
      <div className="history-loading-overlay">
        <div className="loading-spinner"></div>
      </div>
    )}
    if (isItemSelected(item)) {
      console.log("🔄 Item already selected, skipping:", item.id);
      return;
    }

    try {
      console.log("🔄 Loading session for:", item.id);

      const session = await historyService.getSessionById(item.id);

      if (!session || !session.images || session.images.length === 0) {
        console.warn("⚠️ No valid images found for session:", item.id);
        showNotification(
          "warning",
          "No Images",
          "No valid images found in this history item."
        );
        return;
      }

      console.log(
        "✅ Loaded",
        session.images.length,
        "images for session:",
        item.id
      );

      const imageList = session.images.map((img) => ({
        imageUrl: img.imageUrl,
        prompt: img.prompt || "",
        category: img.category || session.category || "",
        subCategory: img.subCategory || session.subCategory || "",
        platform: img.platform || session.platform || "",
        timestamp: img.timestamp || new Date().toISOString(),
        size: "Square",
        quality: "Standard",
        claudeResponse: "",
        AdCreativeA: img.AdCreativeA || "",
        AdCreativeB: img.AdCreativeB || "",
        targeting: "",
        imageName: "",
      }));

      const compatibleItem = {
        sessionId: item.id,
        clickedAt: Date.now(),
        currentImageIndex: 0,
        describe: session.describe || item.describe || "Image session",
        category: session.category || "",
        subCategory: session.subCategory || "",
        platform: session.platform || "",
        list: imageList,
      };

      setProcessedIds((prev) => {
        const updated = new Set(prev);
        updated.add(item.id);
        return updated;
      });

      onItemClick(compatibleItem);
    } catch (error) {
      console.error("❌ Failed to load session images:", error);
      showNotification(
        "error",
        "Load Failed",
        "Failed to load images from server."
      );
    }
  };

  const handleSelectAllUnselected = () => {
    const unselectedItems = allHistoryItems.filter(
      (item) => !isItemSelected(item)
    );

    if (onSelectAll && unselectedItems.length > 0) {
      onSelectAll(unselectedItems.length);
    }

    unselectedItems.reverse().forEach((item, index) => {
      setTimeout(() => {
        handleItemClick(item);
      }, index * 50);
    });
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const handleConfirmClear = async () => {
    try {
      setIsLoading(true);
      historyService.clearCache();
      setAllHistoryItems([]);
      setShowClearConfirm(false);
      setProcessedIds(new Set());

      showNotification(
        "success",
        "History Refreshed",
        "History cache cleared. Reloading latest data..."
      );

      await loadHistoryData();
    } catch (error) {
      console.error("❌ Failed to refresh history:", error);
      setShowClearConfirm(false);
      showNotification(
        "error",
        "Refresh Failed",
        "Could not reload history. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const Row = useCallback(
  ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const ITEMS_PER_ROW = 3;
    const startIdx = index * ITEMS_PER_ROW;
    const itemsInRow = allHistoryItems.slice(
      startIdx,
      startIdx + ITEMS_PER_ROW
    );

    if (itemsInRow.length === 0) return null;

    return (
      <div style={style}>
        <div className="history-row-grid">
          {itemsInRow.map((item) => {
            const isItemDisabled = isItemSelected(item);
            const isLoading = loadingItemId === item.id; // ✅ THÊM

            return (
              <div
                key={item.id}
                className={`history-item ${isItemDisabled ? "disabled" : ""} ${isLoading ? "loading" : ""}`} // ✅ THÊM class
                onClick={() => !isItemDisabled && !isLoading && handleItemClick(item)} // ✅ THÊM check loading
                style={{
                  opacity: isItemDisabled ? 0.5 : 1,
                  cursor: isItemDisabled || isLoading ? "default" : "pointer",
                  position: "relative", // ✅ THÊM
                }}
              >
                {/* ✅ THÊM: Loading overlay trên item */}
                {isLoading && (
                  <div className="history-item-loading">
                    <div className="loading-spinner"></div>
                  </div>
                )}

                <SafeHistoryImage
                  src={item.thumbnail || ""}
                  alt={item.describe || "Generated image"}
                  id={item.id}
                  count={item.imageCount || 0}
                  category={item.category}
                  subCategory={item.subCategory}
                  platform={item.platform}
                />
                {(item.imageCount || 0) > 1 && (
                  <div className="history-item-count">{item.imageCount}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  [allHistoryItems, isItemSelected, handleItemClick, loadingItemId] // ✅ THÊM dependency
);

  const ITEMS_PER_ROW = 3;
  const rowCount = Math.ceil(allHistoryItems.length / ITEMS_PER_ROW);

  return (
    <div className={`history-sidebar ${isVisible ? "visible" : ""}`}>
      {isLoading && allHistoryItems.length > 0 && (
        <div className="history-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      <div className="history-header">
        <div className="history-title-section">
          <span className="history-period">
            History ({allHistoryItems.length})
          </span>
          {isLoading && (
            <span className="loading-indicator">
              <span className="loading-spinner"></span>
            </span>
          )}
        </div>

        {/* ✅ Role Filter UI */}

        <div className="history-actions">
                  {currentUser?.role === "Admin" && availableRoles.length > 0 && (
          <div className="role-filter-wrapper" ref={filterRef}>
            <button
              className="role-filter-trigger"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <svg
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              {selectedRoles.length > 0 && (
                <span className="role-filter-badge">
                  {selectedRoles.length}
                </span>
              )}
            </button>

            {isFilterOpen && (
              <div className="role-filter-dropdown">
                <div className="role-filter-header">
                  <span className="role-filter-title">Filter by role</span>
                  {selectedRoles.length > 0 && (
                    <button className="role-filter-clear" onClick={clearFilters}>
                      Clear
                    </button>
                  )}
                </div>

                {availableRoles.map((role) => (
                    <label key={role} className="role-filter-item">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="role-filter-checkbox"
                      />
                      <span className="role-filter-checkmark">
                        {selectedRoles.includes(role) && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <span className="role-filter-label">{role}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>
        )}
          {hasUnselectedItems && (
            <button
              className="history-action-button"
              onClick={handleSelectAllUnselected}
              title="Add all to canvas"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M4.5 2.5a1 1 0 0 1 1 1v1.572A9.5 9.5 0 1 1 12 21.5c-4.87 0-8.882-3.663-9.435-8.384a1 1 0 0 1 1.986-.232A7.501 7.501 0 0 0 19.5 12 7.5 7.5 0 0 0 6.41 7H9a1 1 0 0 1 0 2H4.5a1 1 0 0 1-1-1.024V3.5a1 1 0 0 1 1-1Z"
                  clipRule="evenodd"
                ></path>
              </svg>
            </button>
          )}

          <button
            className="history-action-button"
            onClick={toggleSidebar}
            title="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 19a1 1 0 1 0 2 0V5a1 1 0 1 0-2 0v14Zm-8.707-2.707a1 1 0 1 0 1.414 1.414l5-5a1 1 0 0 0 0-1.414l-5-5a1 1 0 1 0-1.414 1.414L13.586 11H4a1 1 0 1 0 0 2h9.586l-3.293 3.293Z"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="history-content">
        {showClearConfirm ? (
          <ClearHistoryOverlay
            onCancel={handleCancelClear}
            onConfirm={handleConfirmClear}
            
          />
        ) : isLoading && allHistoryItems.length === 0 ? (
          <div className="history-empty">
            <p>Loading...</p>
          </div>
        ) : allHistoryItems.length === 0 ? (
          <div className="history-empty">
            <p>No history items found</p>
            <button
              className="history-refresh-button"
              onClick={loadHistoryData}
            >
              Refresh
            </button>
          </div>
        ) : (
          <List
            ref={listRef}
            height={window.innerHeight - 120}
            itemCount={rowCount}
            itemSize={120}
            width="100%"
            overscanCount={3}
          >
            {Row}
          </List>
        )}
      </div>
    </div>
  );
};

const SafeHistoryImage: React.FC<{
  src: string;
  alt: string;
  id: string;
  count: number;
  category?: string;
  subCategory?: string;
  platform?: string;
}> = ({ src, alt, count, category, subCategory }) => {
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  return (
    <div className="history-image-container">
      {(category || subCategory) && (
        <div className="category-label category-label-history">
          {category && subCategory
            ? `${category}/${subCategory}`
            : category || subCategory}
        </div>
      )}

      {isLoading && !hasError && (
        <div className="history-image-loading">
          <div className="loading-spinner"></div>
        </div>
      )}

      <img
        src={src}
        alt={alt}
        className="history-image"
        loading="lazy"
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        onLoad={() => {
          setIsLoading(false);
          setHasError(false);
        }}
        style={{ display: hasError ? "none" : "block" }}
      />

      {hasError && (
        <div className="history-image-placeholder">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="200" height="200" fill="#f0f0f0" />
            <text
              x="50%"
              y="50%"
              fontFamily="Arial, sans-serif"
              fontSize="20"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#999"
            >
              {count} images
            </text>
          </svg>
        </div>
      )}
    </div>
  );
};

function showNotification(
  type: "success" | "error" | "warning",
  title: string,
  message: string
) {
  const colors = {
    error: { bg: "#ff6b6b", text: "white" },
    warning: { bg: "#f39c12", text: "white" },
    success: { bg: "#4CAF50", text: "white" },
  };

  const color = colors[type];

  const notification = document.createElement("div");
  notification.innerHTML = `
    <div style="
      position: fixed; 
      top: 20px; 
      right: 20px; 
      background: ${color.bg}; 
      color: ${color.text}; 
      padding: 15px 20px; 
      border-radius: 8px; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 350px;
    ">
      <strong>${title}</strong><br>
      ${message}
    </div>
  `;
  document.body.appendChild(notification);

  setTimeout(
    () => {
      if (notification.parentElement) {
        document.body.removeChild(notification);
      }
    },
    type === "error" ? 5000 : 3000
  );
}

export { HistorySidebar };
export default HistorySidebar;