import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Minus,
  Square,
  Smartphone,
  Monitor,
  Image,
  Shuffle,
  RotateCw,
  Zap,
} from "lucide-react";

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
  // Optional category selection props
  onCategoryChange?: (category: string, subcategory: string) => void;
  // New props for Model and HD mode
  onModelChange?: (model: string) => void;
  onHDModeChange?: (isHD: boolean) => void;
  currentUser?: { email: string; role: string };
}

interface CategoryOption {
  value: string;
  label: string;
}

// ✅ NEW: Interface for dynamic subcategories
interface SubcategoryOption {
  id: string;
  value: string;
  label: string;
  category: string;
  status: "active" | "inactive";
}

const ImageSizeSelector: React.FC<ImageSizeSelectorProps> = ({
  numberOfImages,
  setNumberOfImages,
  imageSizes,
  setImageSizes,
  onCategoryChange,
  onModelChange,
  onHDModeChange,
  currentUser,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isHDMode, setIsHDMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet");
  const [parentCategory, setParentCategory] = useState("google_prompt");
  const [childOption, setChildOption] = useState("");

  // ✅ NEW: States for dynamic subcategories
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);

  const formats = [
    { key: "Square", name: "Square", icon: Square },
    { key: "Portrait", name: "Portrait", icon: Smartphone },
    { key: "Landscape", name: "Landscape", icon: Monitor },
  ];

  const categoryOptions: CategoryOption[] = [
    { value: "google_prompt", label: "Google" },
    { value: "facebook_prompt", label: "Facebook" },
    { value: "website_prompt", label: "Website" }, // ✅ NEW
  ];

  const modelOptions = [{ value: "claude-sonnet", label: "Claude Sonnet" }];

  // ✅ FIXED: Simplified fetch function
  const fetchSubcategories = async () => {
    try {
      setLoadingSubcategories(true);
      console.log("🔄 ===== FETCHING FILTERED SUBCATEGORIES =====");

      // ✅ Use new filtered endpoint
      const response = await fetch("/api/subcategories/filtered");
      const data = await response.json();

      if (data.success) {
        console.log("📊 Filtered subcategories received:", data.subcategories);
        console.log(`✅ Total subcategories: ${data.subcategories.length}`);

        setSubcategories(data.subcategories);
      } else {
        console.error("❌ Failed to fetch filtered subcategories:", data.error);
        setSubcategories([]);
      }
    } catch (error) {
      console.error("❌ Error fetching filtered subcategories:", error);
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  // ✅ NEW: Helper function to convert category display names to API format
  const getCategoryKey = (displayCategory: string): string => {
    const categoryMap: { [key: string]: string } = {
      google_prompt: "google-ads",
      facebook_prompt: "facebook-ads",
      website_prompt: "website-content", // ✅ NEW
    };
    return categoryMap[displayCategory] || displayCategory;
  };

  // ✅ NEW: Helper function to get active subcategories for a category
  const getActiveSubcategoriesForCategory = (
    category: string,
    subcategoriesList?: SubcategoryOption[]
  ): SubcategoryOption[] => {
    const list = subcategoriesList || subcategories;
    // const list = [];
    return list.filter(
      (sub) =>
        sub.category === getCategoryKey(category) && sub.status === "active"
    );
  };

  // ✅ Load subcategories on component mount
  useEffect(() => {
    fetchSubcategories();
  }, [currentUser]);

  // ✅ FIXED: Simplified useEffect for updating childOption
  useEffect(() => {
    const categoryKey = getCategoryKey(parentCategory);
    const availableOptions = getActiveSubcategoriesForCategory(categoryKey);

    if (availableOptions.length > 0) {
      const currentOptionValid = availableOptions.some(
        (opt) => opt.value === childOption
      );
      if (!currentOptionValid) {
        const newChildOption = availableOptions[0].value;
        setChildOption(newChildOption);
        // ✅ FIXED: Single callback without race condition
        if (onCategoryChange) {
          onCategoryChange(parentCategory, newChildOption);
        }
      }
    } else {
      if (childOption !== "") {
        setChildOption("");
        if (onCategoryChange) {
          onCategoryChange(parentCategory, "");
        }
      }
    }
  }, [parentCategory, subcategories]);

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

  const toggleHDMode = () => {
    setIsHDMode((prev) => {
      const newValue = !prev;
      if (onHDModeChange) {
        onHDModeChange(newValue);
      }
      return newValue;
    });
  };

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    if (onModelChange) {
      onModelChange(newModel);
    }
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

  const handleParentCategoryChange = (newCategory: string) => {
    setParentCategory(newCategory);

    // Get available subcategories for new category
    const categoryKey = getCategoryKey(newCategory);
    const availableOptions = getActiveSubcategoriesForCategory(categoryKey);

    if (availableOptions.length > 0) {
      const newChildOption = availableOptions[0].value;
      setChildOption(newChildOption);
      if (onCategoryChange) {
        onCategoryChange(newCategory, newChildOption);
      }
    } else {
      setChildOption("");
      if (onCategoryChange) {
        onCategoryChange(newCategory, "");
      }
    }
  };

  const handleChildOptionChange = (newChildOption: string) => {
    setChildOption(newChildOption);
    if (onCategoryChange) {
      onCategoryChange(parentCategory, newChildOption);
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

    setDragStartX(e.clientX);
    setDragStartValue(numberOfImages);
    setIsDragging(true);

    const clickX = e.clientX;
    const thumbPosition = rect.left + (rect.width * (numberOfImages - 1)) / 9;
    const thumbWidth = 20;

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
      const deltaValue = deltaPercentage * 9;

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
    <div>
      <div className="relative inline-block" ref={dropdownRef}>
        {/* Compact Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center space-x-2 bg-white rounded-sm px-3 py-2 text-sm`}
        >
          <Image className="w-4 h-4 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">
            {isAutoMode
              ? `Auto • ${numberOfImages}`
              : `${getCurrentTotal()}/${numberOfImages}`}
            {isHDMode ? " • HD" : ""}
          </span>
        </button>

        {/* Enhanced Dropdown */}
        {isOpen && (
          <div className="absolute bottom-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-80 overflow-hidden mb-2">
            {/* Enhanced Header Row: Model, Auto, HD, Images */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-3">
              {/* Top Row: Model Selection */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <strong className="text-gray-700">Setting</strong>
                </div>

                {/* Mode Toggles */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={toggleAutoMode}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      isAutoMode
                        ? "bg-gray-200 text-gray-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Auto</span>
                  </button>

                  <button
                    onClick={toggleHDMode}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      isHDMode
                        ? "bg-gray-200 text-gray-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>HD</span>
                  </button>
                </div>
              </div>

              {/* Bottom Row: Images Control */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Total Images</span>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-40 relative">
                      <div
                        ref={sliderRef}
                        className="h-1.5 bg-gray-200 rounded-full cursor-pointer"
                        onMouseDown={handleMouseDown}
                      >
                        <div
                          className="absolute top-0 left-0 h-1.5 rounded-full bg-gray-700"
                          style={{ width: `${sliderPercentage + 6}%` }}
                        />
                        <div
                          className="absolute top-1/2 transform w-3 h-3 bg-white border border-gray-700 rounded-full"
                          style={{
                            left: `calc(${sliderPercentage}%)`,
                            transform: `translateY(-50%) ${
                              isDragging ? "scale(1.1)" : "scale(1)"
                            }`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-700 min-w-[16px]">
                      {numberOfImages}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ UPDATED: Dynamic Category Selection Row */}
            <div className="flex items-center space-x-2 p-3 border-b border-gray-200 bg-gray-25">
              <select
                value={parentCategory}
                onChange={(e) => handleParentCategoryChange(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={childOption}
                onChange={(e) => handleChildOptionChange(e.target.value)}
                disabled={
                  loadingSubcategories ||
                  !getActiveSubcategoriesForCategory(parentCategory).length
                }
                className={`flex-1 px-2 py-1.5 text-xs bg-white border max-w-[50%] border-gray-300 rounded text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 ${
                  loadingSubcategories
                    ? "opacity-50 cursor-not-allowed bg-gray-50"
                    : ""
                }`}
              >
                {loadingSubcategories ? (
                  <option value="">Loading...</option>
                ) : (
                  <>
                    {getActiveSubcategoriesForCategory(parentCategory)
                      .length === 0 ? (
                      <option value="">No options</option>
                    ) : (
                      <>
                        <option value="">Select subcategory...</option>
                        {getActiveSubcategoriesForCategory(parentCategory).map(
                          (option) => (
                            <option key={option.id} value={option.value}>
                              {option.label}
                            </option>
                          )
                        )}
                      </>
                    )}
                  </>
                )}
              </select>
            </div>

            {/* Status & Format Controls */}
            <div className="p-3">
              {/* Status for manual mode */}
              {!isAutoMode && (
                <div className="mb-3 text-center">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      getCurrentTotal() === numberOfImages
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {getCurrentTotal() === numberOfImages
                      ? "✓ Complete"
                      : `${
                          numberOfImages - getCurrentTotal()
                        } images remaining`}
                  </span>
                </div>
              )}

              {/* Format List */}
              <div className="space-y-2">
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
                      className={`flex items-center justify-between px-3 py-2 border rounded-lg transition-colors ${
                        isAutoMode
                          ? "bg-gray-50 border-gray-200"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded flex items-center justify-center border border-gray-300 bg-white">
                          <IconComponent className="w-3.5 h-3.5 text-gray-600" />
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            isAutoMode ? "text-gray-400" : "text-gray-700"
                          }`}
                        >
                          {format.name}
                        </span>
                      </div>

                      {isAutoMode ? (
                        <></>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() =>
                              updateQuantity(
                                format.key as keyof typeof imageSizes,
                                -1
                              )
                            }
                            disabled={!canDecrease}
                            className="w-6 h-6 rounded border border-gray-400 flex items-center justify-center text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div className="w-6 text-center text-sm font-bold text-gray-700">
                            {quantity}
                          </div>

                          <button
                            onClick={() =>
                              updateQuantity(
                                format.key as keyof typeof imageSizes,
                                1
                              )
                            }
                            disabled={!canIncrease}
                            className="w-6 h-6 rounded border border-gray-400 flex items-center justify-center text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reset Button */}
              {!isAutoMode && (
                <div className="mt-3 text-center">
                  <button
                    onClick={resetQuantities}
                    className="inline-flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Reset All</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageSizeSelector;
