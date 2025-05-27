import React, { useState, useRef, useEffect } from 'react';
import './ImageSizeSelector.css';

interface ImageSizeSelectorProps {
  numberOfImages: number;
  setNumberOfImages: (value: number) => void;
  imageSizes: {
    Square: number;
    Portrait: number;
    Landscape: number;
  };
  setImageSizes: React.Dispatch<React.SetStateAction<{
    Square: number;
    Portrait: number;
    Landscape: number;
  }>>;
}

const ImageSizeSelector: React.FC<ImageSizeSelectorProps> = ({
  numberOfImages,
  setNumberOfImages,
  imageSizes,
  setImageSizes
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formats = [
    { key: 'Square', name: 'Square', icon: '⬜' },
    { key: 'Portrait', name: 'Portrait', icon: '📱' },
    { key: 'Landscape', name: 'Landscape', icon: '🖥️' }
  ];

  const generateRandomDistribution = (total: number) => {
    if (total <= 0) return { Square: 0, Portrait: 0, Landscape: 0 };
    
    const result = { Square: 0, Portrait: 0, Landscape: 0 };
    const formatKeys = ['Square', 'Portrait', 'Landscape'] as const;
    
    for (let i = 0; i < total; i++) {
      const randomFormat = formatKeys[Math.floor(Math.random() * formatKeys.length)];
      result[randomFormat]++;
    }
    
    return result;
  };

  const getCurrentTotal = () => {
    return Object.values(imageSizes).reduce((sum, qty) => sum + qty, 0);
  };

  useEffect(() => {
  if (isAutoMode) {
    setImageSizes(generateRandomDistribution(numberOfImages));
  } else {
    setImageSizes(prev => {
      const currentTotal = Object.values(prev).reduce((sum, qty) => sum + qty, 0);
      
      if (currentTotal > numberOfImages) {
        const newSizes = { ...prev };
        let excess = currentTotal - numberOfImages;
        
        while (excess > 0) {
          const maxFormat = Object.keys(newSizes).reduce((max, format) => 
            newSizes[format as keyof typeof newSizes] > newSizes[max as keyof typeof newSizes] ? format : max
          );
          
          if (newSizes[maxFormat as keyof typeof newSizes] > 0) {
            newSizes[maxFormat as keyof typeof newSizes]--;
            excess--;
          } else {
            break;
          }
        }
        
        return newSizes;
      }
      
      return prev;
    });
  }
}, [numberOfImages, isAutoMode, setImageSizes]);

  const toggleAutoMode = () => {
    setIsAutoMode(prev => {
      if (!prev) {
        setImageSizes(generateRandomDistribution(numberOfImages));
        return true;
      } else {
        return false;
      }
    });
  };

  const updateQuantity = (format: keyof typeof imageSizes, delta: number) => {
    if (isAutoMode) return;
    
    setImageSizes(prev => {
      const newValue = Math.max(0, prev[format] + delta);
      const newSizes = { ...prev, [format]: newValue };
      const newTotal = Object.values(newSizes).reduce((sum, qty) => sum + qty, 0);
      
      if (newTotal <= numberOfImages) {
        return newSizes;
      }
      
      return prev;
    });
  };

  const resetQuantities = () => {
    if (!isAutoMode) {
      setImageSizes({ Square: 0, Portrait: 0, Landscape: 0 });
    }
  };

  const handleSliderInteraction = (clientX: number) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newValue = Math.max(1, Math.min(10, Math.round(percentage * 10)));
    
    setNumberOfImages(newValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSliderInteraction(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      handleSliderInteraction(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sliderPercentage = ((numberOfImages - 1) / 9) * 100;

  return (
    <div className="image-size-selector-container" ref={dropdownRef}>
      {/* Trigger Button */}
      <div 
        className="button-menu-3"
        onClick={() => setIsOpen(!isOpen)}
      >

        <img className="SVG-6" alt="Svg" src="/img/svg-10.svg" style={{ cursor: "pointer" }} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="image-selector-dropdown">
          
          {/* Header */}
          <div className="selector-header">
            <div className="header-row">
              <span className="header-title">Image Settings</span>
              <button
                onClick={toggleAutoMode}
                className={`auto-toggle ${isAutoMode ? 'active' : ''}`}
              >
                <span>🔀</span>
                <span>Auto</span>
              </button>
            </div>

            {/* Total Images Slider */}
            <div className="slider-section">
              <div className="slider-header">
                <span className="slider-label">Total Images</span>
                <span className="slider-value">{numberOfImages}</span>
              </div>
              <div className="slider-container">
                <div 
                  ref={sliderRef}
                  className="slider-track"
                  onMouseDown={handleMouseDown}
                >
                  <div 
                    className="slider-progress"
                    style={{ width: `${sliderPercentage}%` }}
                  />
                  <div 
                    className="slider-thumb"
                    style={{ 
                      left: `${sliderPercentage}%`, 
                      transform: `translateX(-50%) translateY(-50%)`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status bar for manual mode */}
          {!isAutoMode && (
            <div className="status-bar">
              <span className={getCurrentTotal() === numberOfImages ? 'complete' : 'remaining'}>
                {getCurrentTotal() === numberOfImages 
                  ? 'All images assigned' 
                  : `${numberOfImages - getCurrentTotal()} images remaining`}
              </span>
            </div>
          )}

          {/* Format Controls */}
          <div className="formats-section">
            {formats.map((format) => {
              const quantity = imageSizes[format.key as keyof typeof imageSizes];
              const canIncrease = !isAutoMode && getCurrentTotal() < numberOfImages;
              const canDecrease = !isAutoMode && quantity > 0;
              
              return (
                <div
                  key={format.key}
                  className={`format-row ${isAutoMode ? 'auto-mode' : 'manual-mode'}`}
                >
                  {/* Format Info */}
                  <div className="format-info">
                    <div className="format-icon">
                      <span>{format.icon}</span>
                    </div>
                    <div className="format-details">
                      <span className={`format-name ${isAutoMode ? 'auto-mode' : 'manual-mode'}`}>
                        {format.name}
                      </span>
                      <span className="format-ratio">
                        {format.key === 'Square' && '1:1 ratio'}
                        {format.key === 'Portrait' && '3:4 ratio'}
                        {format.key === 'Landscape' && '4:3 ratio'}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="quantity-controls">
                    {!isAutoMode ? (
                      <>
                        <button
                          onClick={() => updateQuantity(format.key as keyof typeof imageSizes, -1)}
                          disabled={!canDecrease}
                          className="quantity-btn"
                        >
                          <span>−</span>
                        </button>
                        
                        <div className="quantity-display">
                          {quantity}
                        </div>
                        
                        <button
                          onClick={() => updateQuantity(format.key as keyof typeof imageSizes, 1)}
                          disabled={!canIncrease}
                          className="quantity-btn"
                        >
                          <span>+</span>
                        </button>
                      </>
                    ) : (
                      <div className="quantity-display">
                        {quantity}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer - Only show Reset in Manual mode */}
          {!isAutoMode && (
            <div className="selector-footer">
              <button onClick={resetQuantities} className="reset-btn">
                <span>🔄</span>
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageSizeSelector;