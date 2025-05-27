import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  Minus,
  Square,
  Smartphone,
  Monitor,
  Image,
  Shuffle,
  RotateCw,
} from "lucide-react";
import "./ImageSizeSelector.css";

interface ImageSizeSelectorProps {
  numberOfImages: number;
  setNumberOfImages: (value: number) => void;
  imageSizes: {
    Square: number;
    Portrait: number;
    Landscape: number;
  };
  setImageSizes: React.Dispatch<
    React.SetStateAction<{
      Square: number;
      Portrait: number;
      Landscape: number;
    }>
  >;
}

const ImageSizeSelector: React.FC<ImageSizeSelectorProps> = ({
  numberOfImages,
  setNumberOfImages,
  imageSizes,
  setImageSizes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);

  const formats = [
    { key: "Square", name: "Square", icon: Square },
    { key: "Portrait", name: "Portrait", icon: Smartphone },
    { key: "Landscape", name: "Landscape", icon: Monitor },
  ];

  const generateRandomDistribution = (total: number) => {
    if (total <= 0) return { Square: 0, Portrait: 0, Landscape: 0 };

    const result = { Square: 0, Portrait: 0, Landscape: 0 };
    const formatKeys = ["Square", "Portrait", "Landscape"] as const;

    for (let i = 0; i < total; i++) {
      const randomFormat =
        formatKeys[Math.floor(Math.random() * formatKeys.length)];
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
      setImageSizes((prev) => {
        const currentTotal = Object.values(prev).reduce(
          (sum, qty) => sum + qty,
          0
        );

        if (currentTotal > numberOfImages) {
          const newSizes = { ...prev };
          let excess = currentTotal - numberOfImages;

          while (excess > 0) {
            const maxFormat = Object.keys(newSizes).reduce((max, format) =>
              newSizes[format as keyof typeof newSizes] >
              newSizes[max as keyof typeof newSizes]
                ? format
                : max
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
    setIsAutoMode((prev) => {
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

    setImageSizes((prev) => {
      const newValue = Math.max(0, prev[format] + delta);
      const newSizes = { ...prev, [format]: newValue };
      const newTotal = Object.values(newSizes).reduce(
        (sum, qty) => sum + qty,
        0
      );

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

  const calculateValueFromPosition = (clientX: number) => {
    if (!sliderRef.current) return numberOfImages;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width)
    );
    return Math.max(1, Math.min(10, Math.round(percentage * 9) + 1));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Always start dragging from current mouse position
    setDragStartX(e.clientX);
    setDragStartValue(numberOfImages);
    setIsDragging(true);

    // If clicking on track (not near thumb), jump to that position first
    const clickX = e.clientX;
    const thumbPosition = rect.left + (rect.width * (numberOfImages - 1)) / 9;
    const thumbWidth = 20; // Increase hit area for better UX

    if (Math.abs(clickX - thumbPosition) > thumbWidth) {
      const newValue = calculateValueFromPosition(clickX);
      setNumberOfImages(newValue);
      setDragStartValue(newValue);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      const deltaPercentage = deltaX / rect.width;
      const deltaValue = deltaPercentage * 9; // 9 is the range (10 - 1)

      const newValue = Math.max(
        1,
        Math.min(10, Math.round(dragStartValue + deltaValue))
      );
      setNumberOfImages(newValue);
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove);
        document.removeEventListener("mouseup", handleGlobalMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, dragStartX, dragStartValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sliderPercentage = ((numberOfImages - 1) / 9) * 100;

  return (
    <div className="image-size-selector-container" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`trigger-button ${isOpen ? "open" : ""}`}
      >
        <Image className="trigger-icon" />
        <div className="trigger-content">
          <span className="trigger-text">
            {isAutoMode
              ? `Auto • ${numberOfImages}`
              : `${getCurrentTotal()}/${numberOfImages}`}
          </span>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="image-selector-dropdown">
          {/* Header */}
          <div className="selector-header">
            <div className="header-row">
              <span className="header-title">Image Settings</span>
              <button
                onClick={toggleAutoMode}
                className={`auto-toggle ${isAutoMode ? "active" : ""}`}
              >
                <Shuffle className="auto-icon" />
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
                  style={{ cursor: isDragging ? "grabbing" : "pointer" }}
                >
                  <div
                    className="slider-progress"
                    style={{ width: `${sliderPercentage}%` }}
                  />
                  <div
                    ref={thumbRef}
                    className="slider-thumb"
                    style={{
                      left: `${
                        sliderPercentage === 0
                          ? 2
                          : sliderPercentage === 100
                          ? 98
                          : 2 + sliderPercentage * 0.96
                      }%`,
                      transform: `translateX(-50%) translateY(-50%)`,
                      cursor: isDragging ? "grabbing" : "grab",
                      scale: isDragging ? "1.1" : "1",
                    }}
                  />
                </div>
                {/* Range markers */}
                <div className="slider-markers">
                  <span className="marker-start">1</span>
                  <span className="marker-end">10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status bar for manual mode */}
          {!isAutoMode && (
            <div className="status-bar">
              <span
                className={
                  getCurrentTotal() === numberOfImages
                    ? "complete"
                    : "remaining"
                }
              >
                {getCurrentTotal() === numberOfImages
                  ? "All images assigned"
                  : `${numberOfImages - getCurrentTotal()} images remaining`}
              </span>
            </div>
          )}

          {/* Format Controls */}
          <div className="formats-section">
            {formats.map((format) => {
              const IconComponent = format.icon;
              const quantity =
                imageSizes[format.key as keyof typeof imageSizes];
              const canIncrease =
                !isAutoMode && getCurrentTotal() < numberOfImages;
              const canDecrease = !isAutoMode && quantity > 0;

              return (
                <div
                  key={format.key}
                  className={`format-row ${
                    isAutoMode ? "auto-mode" : "manual-mode"
                  }`}
                >
                  {/* Format Info */}
                  <div className="format-info">
                    <div className="format-icon">
                      <IconComponent className="format-icon-svg" />
                    </div>
                    <span
                      className={`format-name ${
                        isAutoMode ? "auto-mode" : "manual-mode"
                      }`}
                    >
                      {format.name}
                    </span>
                  </div>

                  {/* Display quantity in auto mode */}
                  {isAutoMode && (
                    <div className="quantity-display auto-quantity">
                      {quantity}
                    </div>
                  )}

                  {/* Quantity Controls - Only show in manual mode */}
                  {!isAutoMode && (
                    <div className="quantity-controls">
                      <button
                        onClick={() =>
                          updateQuantity(
                            format.key as keyof typeof imageSizes,
                            -1
                          )
                        }
                        disabled={!canDecrease}
                        className="quantity-btn"
                      >
                        <Minus className="quantity-icon" />
                      </button>

                      <div className="quantity-display">{quantity}</div>

                      <button
                        onClick={() =>
                          updateQuantity(
                            format.key as keyof typeof imageSizes,
                            1
                          )
                        }
                        disabled={!canIncrease}
                        className="quantity-btn"
                      >
                        <Plus className="quantity-icon" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer - Only show Reset in Manual mode */}
          {!isAutoMode && (
            <div className="selector-footer">
              <button onClick={resetQuantities} className="reset-btn">
                <RotateCw className="reset-icon" />
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
