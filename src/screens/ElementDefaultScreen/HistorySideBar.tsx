import React, { useState, useEffect, useCallback, useRef } from "react";
import { storageManager } from "./storageUtils";

interface HistoryImage {
  imageBase64: string;
  prompt: string;
  AdCreativeA?: string;
  AdCreativeB?: string;
  timestamp: string;
}

interface HistoryItem {
  id: string;
  isSelected?: boolean;
  describe?: string;
  list: HistoryImage[];
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
          This will permanently delete your image generation history from this
          device.
        </h4>

        <p className="clear-overlay-description">
          Your image generation history is stored locally on your device using
          browser local storage. Clearing this will permanently delete all image
          generation history from this device, but won't affect the history
          stored on other devices. Your image generation history is not stored
          on our servers.
        </p>
      </div>

      <div className="clear-overlay-footer">
        <button className="clear-overlay-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="clear-overlay-confirm-btn" onClick={onConfirm}>
          Clear history
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
      console.log("🔄 Loading history data...");

      // Get history from storage manager
      const historyGroups = await storageManager.getHistoryForSidebar();

      if (historyGroups && historyGroups.length > 0) {
        console.log("✅ History loaded:", historyGroups.length, "groups with", 
          historyGroups.reduce((sum, group) => sum + group.items.length, 0), "items");
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
            <strong>⚠️ Storage Error</strong><br>
            There was a problem loading your history. Try refreshing the page.
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
            " onclick="localStorage.clear(); window.location.reload();">Reset Storage</button>
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

  // Run emergency fix on first load
  useEffect(() => {
    const runEmergencyFix = async () => {
      try {
        await storageManager.init();
        // This is the safest approach - completely rebuild the storage data
        const fixResult = await storageManager.deduplicateOnStartup();
        console.log('🚨 Emergency storage fix complete');
      } catch (error) {
        console.error('Failed to run emergency fix:', error);
      } finally {
        loadHistoryData();
      }
    };
    
    runEmergencyFix();
    
    const handleHistoryUpdate = () => {
      console.log("📡 History update event received, reloading...");
      loadHistoryData();
    };

    window.addEventListener("historyUpdated", handleHistoryUpdate);

    return () => {
      window.removeEventListener("historyUpdated", handleHistoryUpdate);
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
    // Check if the item has already been processed to prevent multiple selections
    if (isItemSelected(item)) {
      console.log("🔄 Item already selected, skipping:", item.id);
      return;
    }

    try {
      console.log("🔄 Loading session images for:", item.id);

      // Load images from storage system
      const sessionImages = await storageManager.getSessionImages(item.id);

      if (sessionImages && sessionImages.length > 0) {
        console.log("✅ Loaded", sessionImages.length, "images for session:", item.id);

        const compatibleItem = {
          ...item,
          list: sessionImages.map((img) => ({
            imageBase64: img.imageUrl,
            prompt: img.prompt,
            claudeResponse: img.claudeResponse,
            timestamp: img.timestamp,
            size: img.size,
            quality: img.quality,
            AdCreativeA: img.AdCreativeA, 
            AdCreativeB: img.AdCreativeB,
            targeting: img.targeting,
            imageName: img.imageName,
          })),
        };

        // Add this ID to processed set to prevent duplicate processing
        setProcessedIds(prev => {
          const updated = new Set(prev);
          updated.add(item.id);
          return updated;
        });

        onItemClick(compatibleItem);
      } else {
        console.warn("⚠️ No valid images found for session:", item.id);
        
        // Show notification to user
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
      }
    } catch (error) {
      console.error("❌ Failed to load session images:", error);
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
      
      // Use storage manager to clear all sessions
      const result = await storageManager.clearAllSessions();
      
      if (!result) {
        throw new Error("Failed to clear sessions");
      }

      setHistoryData([]);
      setShowClearConfirm(false);
      setProcessedIds(new Set());
      console.log("✅ All history cleared");

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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <strong>✅ History Cleared</strong><br>
          All image generation history has been permanently deleted from this device.
        </div>
      `;
      document.body.appendChild(notification);

      // Auto-remove notification after 4 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          document.body.removeChild(notification);
        }
      }, 2000);
    } catch (error) {
      console.error("❌ Failed to clear history:", error);
      setShowClearConfirm(false);

      // Show error notification
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <strong>❌ Clear Failed</strong><br>
          Could not clear all history. Please try refreshing the page.
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

// Enhanced image component for history thumbnails
const SafeHistoryImage: React.FC<{
  src: string;
  alt: string;
  id: string;
  count: number;
}> = ({ src, alt, id, count }) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  
  useEffect(() => {
    setImageSrc(src);
    setHasError(false);
    setIsLoading(false);
  }, [src]);

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
    setImageSrc("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkltYWdlPC90ZXh0Pjwvc3ZnPg==");
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  return (
    <div className="history-image-container">
      {isLoading && (
        <div className="history-image-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      <img
        src={imageSrc}
        alt={alt}
        className="history-image"
        loading="lazy"
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
      
      {hasError && (
        <div className="history-image-placeholder">
          <span>{count}</span>
        </div>
      )}
    </div>
  );
};

export { HistorySidebar };
export default HistorySidebar;