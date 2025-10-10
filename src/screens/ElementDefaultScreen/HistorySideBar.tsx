import React, { useState, useEffect, useCallback, useRef } from "react";
import { historyService } from "./historyService";

interface HistoryImage {
  imageUrl: string;        // ✅ ĐỔI từ imageBase64
  prompt: string;
  category?: string;       // ✅ THAY platform
  subCategory?: string;    // ✅ THÊM
  AdCreativeA?: string;
  AdCreativeB?: string;
  timestamp: string;
}

interface HistoryItem {
  id: string;
  isSelected?: boolean;
  describe?: string;
  category?: string;       // ✅ THÊM
  subCategory?: string;    // ✅ THÊM
  list: HistoryImage[];
  thumbnail?: string;      // ✅ THÊM để cache thumbnail
  imageCount?: number;     // ✅ THÊM để cache count
}

interface HistoryDateGroup {
  date: string;
  items: HistoryItem[];
}

interface HistorySidebarProps {
  isVisible: boolean;
  toggleSidebar: () => void;
  onItemClick: (item: HistoryItem) => void;
  selectedImages: Array<{
    imageUrl: string;
    clickedAt: number;
    sessionId?: string;
  }>;
  onSelectAll?: (unselectedCount: number) => void;
  maxGridItems?: number;
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
          Your image generation history is stored on our servers. 
          This action will clear the local cache and reload the latest 
          data from the server. Your history will not be deleted from 
          the database.
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
  maxGridItems
}) => {
  const [historyData, setHistoryData] = useState<HistoryDateGroup[]>([]);
  const [hasUnselectedItems, setHasUnselectedItems] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const loadingRef = useRef<boolean>(false);
  const errorShownRef = useRef<boolean>(false);

  const loadHistoryData = useCallback(async () => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    
    try {
      console.log("🔄 Loading history data from N8N API...");

      // ✅ Fetch từ N8N API thay vì storage
      const sessions = await historyService.fetchHistory();

      if (sessions && sessions.length > 0) {
        console.log("✅ History loaded:", sessions.length, "sessions");
        
        // ✅ Group theo ngày
        const historyGroups = historyService.groupByDate(sessions);
        
        console.log("📊 History grouped into", historyGroups.length, "date groups");
        setHistoryData(historyGroups);
      } else {
        console.log("📭 No history data found");
        setHistoryData([]);
      }
    } catch (error) {
      console.error("❌ Failed to load history:", error);
      setHistoryData([]);
      
      // Show error notification (only once per session)
      if (!errorShownRef.current) {
        errorShownRef.current = true;
        
        const notification = document.createElement("div");
        notification.innerHTML = `
          <div style="
            position: fixed; 
            top: 20px; 
            right: 20px; 
            background: #f44336; 
            color: white; 
            padding: 15px 20px; 
            border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <strong>⚠️ Failed to Load History</strong><br>
            Could not fetch history from server. Please check your connection.
            <button style="
              display: block;
              margin-top: 8px;
              background: white;
              color: #f44336;
              border: none;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            " onclick="this.parentElement.parentElement.remove();">Close</button>
          </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          if (notification.parentElement) {
            document.body.removeChild(notification);
          }
        }, 10000);
      }
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // ✅ Load ngay khi mount
    loadHistoryData();
    
    // ✅ KHÔNG cần historyUpdated event nữa
    // Data luôn fresh từ API
    
    return () => {
      // Cleanup if needed
    };
  }, [loadHistoryData]);

  const isItemSelected = useCallback(
    (item: HistoryItem): boolean => {
      return selectedImages.some((img) => img.sessionId === item.id);
    },
    [selectedImages]
  );

  useEffect(() => {
    const anyUnselectedItems = historyData.some((group) =>
      group.items.some((item) => !isItemSelected(item))
    );

    setHasUnselectedItems(anyUnselectedItems);
  }, [historyData, isItemSelected]);

 const handleItemClick = async (item: HistoryItem) => {
  // Check if already selected
  if (isItemSelected(item)) {
    console.log("🔄 Item already selected, skipping:", item.id);
    return;
  }

  try {
    console.log("🔄 Loading session for:", item.id);

    // ✅ Fetch session từ API
    const session = await historyService.getSessionById(item.id);

    if (!session || !session.images || session.images.length === 0) {
      console.warn("⚠️ No valid images found for session:", item.id);
      
      const notification = document.createElement("div");
      notification.innerHTML = `
        <div style="
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #ff9800; 
          color: white; 
          padding: 15px 20px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
        ">
          <strong>No Images</strong><br>
          No valid images found in this history item.
        </div>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentElement) {
          document.body.removeChild(notification);
        }
      }, 3000);
      
      return;
    }

    console.log("✅ Loaded", session.images.length, "images for session:", item.id);

    // ✅ KHÔNG CẦN convert blob nữa - dùng URLs trực tiếp
    const imageList = session.images.map(img => ({
      imageUrl: img.imageUrl,  // ✅ URL trực tiếp, không convert
      prompt: img.prompt || '',
      category: img.category || session.category || '',
      subCategory: img.subCategory || session.subCategory || '',
      timestamp: img.timestamp || new Date().toISOString(),
      size: 'Square',
      quality: 'Standard',
      claudeResponse: '',
      AdCreativeA: img.AdCreativeA || '',
      AdCreativeB: img.AdCreativeB || '',
      targeting: '',
      imageName: '',
    }));

    const compatibleItem = {
      sessionId: item.id,
      clickedAt: Date.now(),
      currentImageIndex: 0,
      describe: session.describe || item.describe || "Image session",
      category: session.category || '',
      subCategory: session.subCategory || '',
      list: imageList,  // ✅ URLs trực tiếp, không có blob
    };

    // Add to processed set
    setProcessedIds(prev => {
      const updated = new Set(prev);
      updated.add(item.id);
      return updated;
    });

    console.log("✅ Prepared session for display:", {
      sessionId: item.id,
      imageCount: imageList.length,
      category: session.category,
      subCategory: session.subCategory,
    });

    onItemClick(compatibleItem);
  } catch (error) {
    console.error("❌ Failed to load session images:", error);
    
    const errorNotification = document.createElement("div");
    errorNotification.innerHTML = `
      <div style="
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #f44336; 
        color: white; 
        padding: 15px 20px; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
      ">
        <strong>❌ Load Failed</strong><br>
        Failed to load images from server.
      </div>
    `;
    document.body.appendChild(errorNotification);
    
    setTimeout(() => {
      if (errorNotification.parentElement) {
        document.body.removeChild(errorNotification);
      }
    }, 3000);
  }
};

  const handleSelectAllUnselected = () => {
    // Count unselected items
    let unselectedItems: HistoryItem[] = [];
    
    historyData.forEach(group => {
      group.items.forEach(item => {
        if (!isItemSelected(item)) {
          unselectedItems.push(item);
        }
      });
    });
    
    if (onSelectAll && unselectedItems.length > 0) {
      onSelectAll(unselectedItems.length);
    }

    unselectedItems.reverse();
    
    // Process them one by one with a small delay to prevent racing conditions
    unselectedItems.forEach((item, index) => {
      setTimeout(() => {
        handleItemClick(item);
      }, index * 50); // 50ms delay between each item
    });
  };

  const clearHistory = () => {
    setShowClearConfirm(true);
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const handleConfirmClear = async () => {
    try {
      setIsLoading(true);
      
      // ✅ Chỉ cần clear cache, không xóa database
      historyService.clearCache();
      
      setHistoryData([]);
      setShowClearConfirm(false);
      setProcessedIds(new Set());
      console.log("✅ History cache cleared");

      // Show success notification
      const notification = document.createElement("div");
      notification.innerHTML = `
        <div style="
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #4CAF50; 
          color: white; 
          padding: 15px 20px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
        ">
          <strong>✅ History Refreshed</strong><br>
          History cache cleared. Reloading latest data...
        </div>
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        if (notification.parentElement) {
          document.body.removeChild(notification);
        }
      }, 2000);
      
      // ✅ Reload fresh data từ API
      await loadHistoryData();
    } catch (error) {
      console.error("❌ Failed to refresh history:", error);
      setShowClearConfirm(false);

      const errorNotification = document.createElement("div");
      errorNotification.innerHTML = `
        <div style="
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #f44336; 
          color: white; 
          padding: 15px 20px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
        ">
          <strong>❌ Refresh Failed</strong><br>
          Could not reload history. Please try again.
        </div>
      `;
      document.body.appendChild(errorNotification);

      setTimeout(() => {
        if (errorNotification.parentElement) {
          document.body.removeChild(errorNotification);
        }
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Force reload when visibility changes
  useEffect(() => {
    if (isVisible) {
      loadHistoryData();
    }
  }, [isVisible, loadHistoryData]);

  return (
    <div className={`history-sidebar ${isVisible ? "visible" : ""}`}>
      <div className="history-header">
        <div className="history-title-section">
          <span className="history-period">History</span>
          {isLoading && (
            <span className="loading-indicator">
              <span className="loading-spinner"></span>
            </span>
          )}
        </div>

        <div className="history-actions">
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
            onClick={clearHistory}
            title="Clear history"
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
                d="M20.719 4.696a1 1 0 0 0-1.415-1.415l-4.796 4.796-.634-.635a3.002 3.002 0 0 0-3.788-.375l-7.64 5.093a1 1 0 0 0-.153 1.541l8.005 8.005a1.002 1.002 0 0 0 1.541-.152l5.093-7.64a3.001 3.001 0 0 0-.375-3.789l-.634-.633 4.796-4.796Zm-9.523 4.037a1 1 0 0 1 1.263.124l2.682 2.684a1 1 0 0 1 .126 1.262l-.414.621-4.278-4.277.62-.414ZM8.877 10.28l-4.305 2.87 1.43 1.43 1.294-1.292a1 1 0 0 1 1.415 1.415l-1.294 1.294 3.433 3.432 2.871-4.306-4.844-4.843Z"
                clipRule="evenodd"
              ></path>
            </svg>
          </button>

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
        ) : (
          <>
            {!historyData || historyData.length === 0 ? (
              <div className="history-empty">
                <p>{isLoading ? "Loading..." : "No history items found"}</p>
                
                {!isLoading && (
                  <button 
                    className="history-refresh-button"
                    onClick={loadHistoryData}
                  >
                    Refresh
                  </button>
                )}
              </div>
            ) : (
              <HistoryDisplay
                historyData={historyData}
                isItemSelected={isItemSelected}
                handleItemClick={handleItemClick}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Separate component for history display to improve performance
const HistoryDisplay: React.FC<{
  historyData: HistoryDateGroup[];
  isItemSelected: (item: HistoryItem) => boolean;
  handleItemClick: (item: HistoryItem) => void;
}> = React.memo(({ historyData, isItemSelected, handleItemClick }) => {
  return (
    <>
      {historyData.map((dateGroup, groupIndex) => (
        <div key={`date-${groupIndex}-${dateGroup.date}`} className="history-date-group">
          <div className="history-date">{dateGroup.date}</div>

          <div className="history-items">
            {dateGroup.items.map((item) => {
              const isItemDisabled = isItemSelected(item);
              
              return (
                <div
                  key={`item-${item.id}`}
                  className={`history-item ${isItemDisabled ? "disabled" : ""}`}
                  onClick={() => !isItemDisabled && handleItemClick(item)}
                  style={{
                    opacity: isItemDisabled ? 0.5 : 1,
                    cursor: isItemDisabled ? "default" : "pointer",
                  }}
                >
                  <SafeHistoryImage 
                    src={item.thumbnail}
                    alt={item.describe || "Generated image"}
                    id={item.id}
                    count={item.imageCount}
                    category={item.category}        // ✅ THAY platform
                    subCategory={item.subCategory}  // ✅ THÊM
                  />

                  {item.imageCount > 1 && (
                    <div className="history-item-count">{item.imageCount}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
});

const SafeHistoryImage: React.FC<{
  src: string;
  alt: string;
  id: string;
  count: number;
  category?: string;     // ✅ THAY platform
  subCategory?: string;  // ✅ THÊM
}> = ({ src, alt, id, count, category, subCategory }) => {
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  return (
    <div className="history-image-container">
      {/* ✅ THÊM category label */}
      {(category || subCategory) && (
        <div className="category-label category-label-history">
          {category && subCategory 
            ? `${category}/${subCategory}`
            : category || subCategory
          }
        </div>
      )}
      
      {isLoading && (
        <div className="history-image-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {/* ✅ Dùng URL trực tiếp, không convert blob */}
      <img
        src={src}
        alt={alt}
        className="history-image"
        loading="lazy"
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
      
      {hasError && (
        <div className="history-image-placeholder">
          <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 200 200" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="200" height="200" fill="#f0f0f0"/>
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

export { HistorySidebar };
export default HistorySidebar;