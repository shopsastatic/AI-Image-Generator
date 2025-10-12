import React, { useState, useEffect, useCallback, useRef } from "react";
import { historyService } from "./historyService";
import { FixedSizeList as List } from 'react-window';

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
}) => {
  const [allHistoryItems, setAllHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  
  const loadingRef = useRef<boolean>(false);
  const errorShownRef = useRef<boolean>(false);
  const listRef = useRef<any>(null);

  const loadHistoryData = useCallback(async () => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    
    try {
      const sessions = await historyService.fetchHistory();
      
      if (sessions && sessions.length > 0) {
        console.log("✅ History loaded:", sessions.length, "sessions");
        
        const allItems: HistoryItem[] = sessions.map(session => ({
          id: session.sessionId,
          describe: session.describe,
          category: session.category,
          subCategory: session.subCategory,
          platform: session.platform,
          list: session.images.map(img => ({
            imageUrl: img.imageUrl,
            prompt: img.prompt,
            category: img.category,
            subCategory: img.subCategory,
            platform: img.platform,
            timestamp: img.timestamp,
            AdCreativeA: '',
            AdCreativeB: '',
          })),
          thumbnail: session.images[0]?.imageUrl || '',
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
        showNotification('error', 'Failed to Load History', 'Could not fetch history from server.');
      }
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadHistoryData();
    }
  }, [isVisible, loadHistoryData]);

  const isItemSelected = useCallback(
    (item: HistoryItem): boolean => {
      return selectedImages.some((img) => img.sessionId === item.id);
    },
    [selectedImages]
  );

  const hasUnselectedItems = allHistoryItems.some(item => !isItemSelected(item));

  const handleItemClick = async (item: HistoryItem) => {
    if (isItemSelected(item)) {
      console.log("🔄 Item already selected, skipping:", item.id);
      return;
    }

    try {
      console.log("🔄 Loading session for:", item.id);

      const session = await historyService.getSessionById(item.id);

      if (!session || !session.images || session.images.length === 0) {
        console.warn("⚠️ No valid images found for session:", item.id);
        showNotification('warning', 'No Images', 'No valid images found in this history item.');
        return;
      }

      console.log("✅ Loaded", session.images.length, "images for session:", item.id);

      const imageList = session.images.map(img => ({
        imageUrl: img.imageUrl,
        prompt: img.prompt || '',
        category: img.category || session.category || '',
        subCategory: img.subCategory || session.subCategory || '',
        platform: img.platform || session.platform || '',
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
        platform: session.platform || '',
        list: imageList,
      };

      setProcessedIds(prev => {
        const updated = new Set(prev);
        updated.add(item.id);
        return updated;
      });

      onItemClick(compatibleItem);
    } catch (error) {
      console.error("❌ Failed to load session images:", error);
      showNotification('error', 'Load Failed', 'Failed to load images from server.');
    }
  };

  const handleSelectAllUnselected = () => {
    const unselectedItems = allHistoryItems.filter(item => !isItemSelected(item));
    
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
      
      showNotification('success', 'History Refreshed', 'History cache cleared. Reloading latest data...');
      
      await loadHistoryData();
    } catch (error) {
      console.error("❌ Failed to refresh history:", error);
      setShowClearConfirm(false);
      showNotification('error', 'Refresh Failed', 'Could not reload history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Row renderer với grid layout bên trong
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    // Mỗi row chứa 3 items (grid 3 cột)
    const ITEMS_PER_ROW = 3;
    const startIdx = index * ITEMS_PER_ROW;
    const itemsInRow = allHistoryItems.slice(startIdx, startIdx + ITEMS_PER_ROW);

    if (itemsInRow.length === 0) return null;

    return (
      <div style={style}>
        <div className="history-row-grid">
          {itemsInRow.map((item) => {
            const isItemDisabled = isItemSelected(item);
            
            return (
              <div
                key={item.id}
                className={`history-item ${isItemDisabled ? "disabled" : ""}`}
                onClick={() => !isItemDisabled && handleItemClick(item)}
                style={{
                  opacity: isItemDisabled ? 0.5 : 1,
                  cursor: isItemDisabled ? "default" : "pointer",
                }}
              >
                <SafeHistoryImage 
                  src={item.thumbnail || ''}
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
  }, [allHistoryItems, isItemSelected, handleItemClick]);

  // Tính số rows cần thiết
  const ITEMS_PER_ROW = 3;
  const rowCount = Math.ceil(allHistoryItems.length / ITEMS_PER_ROW);

  return (
    <div className={`history-sidebar ${isVisible ? "visible" : ""}`}>
      <div className="history-header">
        <div className="history-title-section">
          <span className="history-period">History ({allHistoryItems.length})</span>
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
            onClick={() => setShowClearConfirm(true)}
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
            : category || subCategory
          }
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
        style={{ display: hasError ? 'none' : 'block' }}
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

function showNotification(type: 'success' | 'error' | 'warning', title: string, message: string) {
  const colors = {
    error: { bg: '#ff6b6b', text: 'white' },
    warning: { bg: '#f39c12', text: 'white' },
    success: { bg: '#4CAF50', text: 'white' },
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

  setTimeout(() => {
    if (notification.parentElement) {
      document.body.removeChild(notification);
    }
  }, type === 'error' ? 5000 : 3000);
}

export { HistorySidebar };
export default HistorySidebar;