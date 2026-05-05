import React, { useState, useRef, useEffect } from "react";
import {
  Square,
  Smartphone,
  Monitor,
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
  // New props for API selection
  onApiChange?: (apis: string[]) => void; // ["nano", "seed"] or ["nano"] or ["seed"]
  onAspectRatioChange?: (aspectRatio: string) => void; // ✅ ADDED
  onResolutionChange?: (resolution: "1k" | "2k" | "4k") => void; // ✅ NEW: Resolution callback
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

// ✅ NEW: Aspect ratio options
interface AspectRatioOption {
  value: string;
  label: string;
  format: "Square" | "Portrait" | "Landscape";
}

const ImageSizeSelector: React.FC<ImageSizeSelectorProps> = ({
  numberOfImages,
  setNumberOfImages,
  imageSizes,
  setImageSizes,
  onCategoryChange,
  onApiChange,
  onAspectRatioChange, // ✅ ADDED
  onResolutionChange, // ✅ NEW
  currentUser,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // ✅ NEW: API selection states (chỉ còn GPT2)
  const [useNano2, setUseNano2] = useState(false);
  const [useNano, setUseNano] = useState(false);
  const [useSeed, setUseSeed] = useState(false);
  const [useOpenAI, setUseOpenAI] = useState(true);

  // ✅ NEW: Resolution state (1k, 2k, 4k)
  const [selectedResolution, setSelectedResolution] = useState<"1k" | "2k" | "4k">("1k");

    // ✅ NEW: States for dynamic subcategories
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  
  const [parentCategory, setParentCategory] = useState("facebook_prompt");
  const [childOption, setChildOption] = useState("");
  const [instructionsSubcategory, setInstructionsSubcategory] = useState("");
  
  const hasSetDefaultRef = useRef(false);

  useEffect(() => {
    if (!hasSetDefaultRef.current && !loadingSubcategories && subcategories.length > 0) {
      const instructionsOpts = getActiveSubcategoriesForCategory("instructions");
      const hasDefault = instructionsOpts.some(opt => opt.value === "create-prompt-product-info");
      
      if (hasDefault) {
        setInstructionsSubcategory("create-prompt-product-info");
        onCategoryChange?.("instructions", "create-prompt-product-info");
        hasSetDefaultRef.current = true;
      }
    }
  }, [loadingSubcategories, subcategories]);

  useEffect(() => {
    if (useSeed) {
      if (numberOfImages < 5) {
        setNumberOfImages(5);
      }
    } else {
      if (numberOfImages > 5) {
        setNumberOfImages(5);
      }
    }
  }, [useSeed]);

  // ✅ NEW: Single aspect ratio state (default Square HD)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);

  const categoryOptions: CategoryOption[] = [
    { value: "google_prompt", label: "Google" },
    { value: "facebook_prompt", label: "Facebook" },
    { value: "website_prompt", label: "Website" },
    { value: "social_prompt", label: "Social" },
  ];

  const categoryInstructions: CategoryOption[] = [
    { value: "instructions", label: "Instructions" },
  ];

  // ✅ NEW: All aspect ratio options in single list
  const aspectRatioOptions: AspectRatioOption[] = [
    { value: "Square HD", label: "Square HD", format: "Square" },
    { value: "Portrait 3:4", label: "Portrait 3:4", format: "Portrait" },
    { value: "Portrait 2:3", label: "Portrait 2:3", format: "Portrait" },
    { value: "Portrait 4:5", label: "Portrait 4:5", format: "Portrait" },
    { value: "Portrait 9:16", label: "Portrait 9:16", format: "Portrait" },
    { value: "Landscape 4:3", label: "Landscape 4:3", format: "Landscape" },
    { value: "Landscape 3:2", label: "Landscape 3:2", format: "Landscape" },
    { value: "Landscape 5:4", label: "Landscape 5:4", format: "Landscape" },
    { value: "Landscape 16:9", label: "Landscape 16:9", format: "Landscape" },
    { value: "Landscape 21:9", label: "Landscape 21:9", format: "Landscape" },
  ];

  // ✅ NEW: Get icon and format type for selected aspect ratio
  const getIconForAspectRatio = (ratio: string) => {
    const option = aspectRatioOptions.find(opt => opt.value === ratio);
    if (!option) return Square;
    
    switch (option.format) {
      case "Square": return Square;
      case "Portrait": return Smartphone;
      case "Landscape": return Monitor;
      default: return Square;
    }
  };

  const toggleOpenAI = () => {
    setUseNano2(false);
    setUseNano(false);
    setUseSeed(false);
    setUseOpenAI(true);
  };

  useEffect(() => {
    const selectedApis: string[] = [];
    
    // Always have exactly one selected
    if (useNano2) selectedApis.push("nano2");
    else if (useNano) selectedApis.push("nano");
    else if (useSeed) selectedApis.push("prompt");
    else if (useOpenAI) selectedApis.push("openai");
    else selectedApis.push("openai"); // fallback default → GPT2
    
    if (onApiChange) {
      onApiChange(selectedApis);
    }
  }, [useNano2, useNano, useSeed, useOpenAI]);

  // ✅ ADDED: Notify parent when aspect ratio changes
  useEffect(() => {

    if (onAspectRatioChange) {
      onAspectRatioChange(selectedAspectRatio);
    } else {
      console.warn("⚠️ onAspectRatioChange callback not provided by parent");
    }
  }, [selectedAspectRatio]); // Only selectedAspectRatio, not onAspectRatioChange

  // ✅ NEW: Notify parent when resolution changes
  useEffect(() => {
    if (onResolutionChange) {
      onResolutionChange(selectedResolution);
    }
  }, [selectedResolution]);

  // ✅ FIXED: Simplified fetch function
const fetchSubcategories = async () => {
  try {
    console.log("🔄 Fetching subcategories...");
    const response = await fetch("/api/subcategories");
    const data = await response.json();

    if (data.success) {
      console.log(`📊 Raw subcategories from API:`, data.subcategories);
      
      // ✅ FIX: Sort by order before setting state
      const sorted = data.subcategories.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      console.log(`✅ Sorted ${sorted.length} subcategories by order`);
      setSubcategories(sorted);
    } else {
      console.error("❌ Failed to fetch subcategories:", data.error);
      setSubcategories([]);
    }
  } catch (error) {
    console.error("❌ Error fetching subcategories:", error);
    setSubcategories([]);
  }
};

  // ✅ NEW: Helper function to convert category display names to API format
  const getCategoryKey = (displayCategory: string): string => {
    const categoryMap: { [key: string]: string } = {
      google_prompt: "google-ads",
      facebook_prompt: "facebook-ads",
      website_prompt: "website-content",
      social_prompt: "social"
    };
    return categoryMap[displayCategory] || displayCategory;
  };

  // ✅ NEW: Helper function to get active subcategories for a category
  const getActiveSubcategoriesForCategory = (
  category: string,
  subcategoriesList?: SubcategoryOption[]
): SubcategoryOption[] => {
  const list = subcategoriesList || subcategories;
  
  // ✅ Filter and sort
  return list
    .filter(
      (sub) =>
        sub.category === getCategoryKey(category) && sub.status === "active"
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0)); // ✅ This should already be here
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
      // ✅ FIX: Chỉ validate nếu đã có giá trị, không tự động set
      if (childOption !== "") {
        const currentOptionValid = availableOptions.some(
          (opt) => opt.value === childOption
        );
        if (!currentOptionValid) {
          // Reset về empty nếu option hiện tại không hợp lệ
          setChildOption("");
          if (onCategoryChange) {
            onCategoryChange(parentCategory, "");
          }
        }
      }
    } else {
      // Không có options → set về empty
      if (childOption !== "") {
        setChildOption("");
        if (onCategoryChange) {
          onCategoryChange(parentCategory, "");
        }
      }
    }
  }, [parentCategory, subcategories]);

  const toggleNano2 = () => {
    setUseNano2(true);
    setUseNano(false);
    setUseSeed(false);
    setUseOpenAI(false);
  };

  // ✅ NEW: Toggle Nano API
  const toggleNano = () => {
    setUseNano2(false);
    setUseNano(true);
    setUseSeed(false);
    setUseOpenAI(false);
  };

  // ✅ NEW: Toggle SeeD API
  const toggleSeed = () => {
    setUseNano2(false);
    setUseNano(false);
    setUseSeed(true);
    setUseOpenAI(false);
  };

  const handleParentCategoryChange = (newCategory: string) => {
    setParentCategory(newCategory);

    // ✅ FIX: Set về empty thay vì tự động chọn option đầu
    setChildOption("");
    if (onCategoryChange) {
      onCategoryChange(newCategory, "");
    }
  };

  const handleChildOptionChange = (newChildOption: string) => {
    setChildOption(newChildOption);
    if (onCategoryChange) {
      onCategoryChange(parentCategory, newChildOption);
    }
  };

  // ✅ UPDATED: Calculate value from position for max 5
  const calculateValueFromPosition = (clientX: number) => {
    if (!sliderRef.current) return numberOfImages;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    // ✅ Dynamic max based on useSeed
    const maxImages = useSeed ? 20 : 5;
    return Math.max(1, Math.min(maxImages, Math.round(percentage * (maxImages - 1)) + 1));
  };

const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault();
  const rect = sliderRef.current?.getBoundingClientRect();
  if (!rect) return;

  setDragStartX(e.clientX);
  setDragStartValue(numberOfImages);
  setIsDragging(true);

  const clickX = e.clientX;
  const maxImages = useSeed ? 20 : 5; // ✅ Dynamic
  const thumbPosition = rect.left + (rect.width * (numberOfImages - 1)) / (maxImages - 1); // ✅ Dynamic
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
      
      // ✅ Dynamic max based on useSeed
      const maxImages = useSeed ? 20 : 5;
      const deltaValue = deltaPercentage * (maxImages - 1);

      const newValue = Math.max(
        1,
        Math.min(maxImages, Math.round(dragStartValue + deltaValue))
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
  }, [isDragging, dragStartX, dragStartValue, useSeed]); // ✅ Thêm useSeed vào dependencies

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

  // ✅ UPDATED: Slider percentage for max 5
  const maxImages = useSeed ? 20 : 5;
  const sliderPercentage = ((numberOfImages - 1) / (maxImages - 1)) * 100;

  // ✅ NEW: Get API status text
  const getApiStatusText = () => {
    const selected = [];
    if (useNano2) selected.push("Nano2");
    if (useNano) selected.push("Nano");
    if (useSeed) selected.push("Prompt");
    if (useOpenAI) selected.push("GPT2");

    if (selected.length === 0) return "GPT2";
    return selected.join(" • ");
  };

  return (
    <div>
      <div className="relative inline-block" ref={dropdownRef}>
        {/* Compact Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center space-x-2 bg-white rounded-xl px-3 py-2 text-sm`}
        >
          {React.createElement(getIconForAspectRatio(selectedAspectRatio), { 
            className: "w-4 h-4 text-gray-700" 
          })}
          <span className="text-sm font-medium text-gray-700">
            {aspectRatioOptions.find(opt => opt.value === selectedAspectRatio)?.label || "Square HD"}
            {` • ${numberOfImages}`}
            {` • ${getApiStatusText()}`}
            {` • ${selectedResolution.toUpperCase()}`}
          </span>
        </button>

        {/* Enhanced Dropdown */}
        {isOpen && (
          <div className="absolute bottom-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl z-50 w-80 overflow-hidden mb-2">
            {/* Enhanced Header Row: Nano, SeeD, Images */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-3">
              {/* Top Row: API Selection */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <strong className="text-gray-700">Setting</strong>
                </div>

                {/* API Toggles */}
                <div className="flex items-center space-x-1">
                  {/* <button
                    onClick={toggleNano2}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      useNano2
                        ? "bg-purple-100 text-purple-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>Nano2</span>
                  </button>
                  <button
                    onClick={toggleNano}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      useNano
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>Nano</span>
                  </button>

                  <button
                    onClick={toggleSeed}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      useSeed
                        ? "bg-green-100 text-green-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>Prompt</span>
                  </button> */}

                  <button
                    onClick={toggleOpenAI}
                    className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      useOpenAI
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>GPT2</span>
                  </button>
                </div>
              </div>

              {/* Bottom Row: Images Control */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-600 whitespace-nowrap">Total Images</span>

                <div className="flex items-center gap-3 flex-1 justify-end">
                  <div className="w-36 relative">
                    <div
                      ref={sliderRef}
                      className="h-1.5 bg-gray-200 rounded-full cursor-pointer"
                      onMouseDown={handleMouseDown}
                    >
                      <div
                        className="absolute top-0 left-0 h-1.5 rounded-full bg-gray-700 transition-all pointer-events-none"
                        style={{ width: `${sliderPercentage}%` }}
                      />
                      <div
                        className="absolute top-1/2 w-3.5 h-3.5 bg-white border-2 border-gray-700 rounded-full transition-all pointer-events-none"
                        style={{
                          left: `${sliderPercentage}%`,
                          transform: `translate(-50%, -50%) ${
                            isDragging ? "scale(1.15)" : "scale(1)"
                          }`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-4 text-right">
                    {numberOfImages}
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Category Selection Row */}
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
                        <option value="">---</option>
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

           <div className="flex items-center space-x-2 p-3 border-b border-gray-200 bg-gray-25">
            <select
              value="instructions"
              disabled
              className="flex-1 px-2 py-1.5 text-xs bg-gray-100 border border-gray-300 rounded text-gray-700 cursor-not-allowed"
            >
              {categoryInstructions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={instructionsSubcategory} // ✅ Dùng state riêng
              onChange={(e) => {
                const newValue = e.target.value;
                console.log("📝 Instructions subcategory changed:", newValue);
                
                setInstructionsSubcategory(newValue); // ✅ Update state riêng
                
                if (onCategoryChange) {
                  console.log("✅ Firing onCategoryChange:", "instructions", newValue);
                  onCategoryChange("instructions", newValue); // ✅ Force "instructions"
                }
              }}
              disabled={
                loadingSubcategories ||
                !getActiveSubcategoriesForCategory("instructions").length
              }
              className={`flex-1 px-2 py-1.5 text-xs bg-white border max-w-[50%] border-gray-300 rounded text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 ${
                loadingSubcategories ? "opacity-50 cursor-not-allowed bg-gray-50" : ""
              }`}
            >
              {loadingSubcategories ? (
                <option value="">Loading...</option>
              ) : (
                <>
                  {getActiveSubcategoriesForCategory("instructions").length === 0 ? (
                    <option value="">No options</option>
                  ) : (
                    <>
                      <option value="">---</option>
                      {getActiveSubcategoriesForCategory("instructions").map(
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

            {/* Aspect Ratio Selection */}
            <div className="p-3">
              <label className="block text-xs text-gray-600 mb-2">Aspect Ratio</label>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded flex items-center justify-center border border-gray-300 bg-white shrink-0">
                  {React.createElement(getIconForAspectRatio(selectedAspectRatio), {
                    className: "w-4 h-4 text-gray-600"
                  })}
                </div>
                <select
                  value={selectedAspectRatio}
                  onChange={(e) => setSelectedAspectRatio(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                >
                  {aspectRatioOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ✅ NEW: Resolution Selection */}
            <div className="p-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Resolution</label>
                <div className="flex items-center space-x-1">
                  {(["1k", "2k", "4k"] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setSelectedResolution(res)}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                        selectedResolution === res
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageSizeSelector;