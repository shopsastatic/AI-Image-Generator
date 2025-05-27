import React, { useEffect, useRef, useState, useCallback } from "react";
import "./style.css";
import HistorySidebar from "./HistorySideBar";
import ImageInfoDropdown from "./ImageInfoDropdown";
import ImageSizeSelector from "./ImageSizeSelector";
import { API_ENDPOINTS } from "../../utils/apiConfig";
import {
  storageManager,
  StorageMigration,
  ImageCompressor,
} from "./storageUtils";

const parseClaudeResponse = (response: string) => {
  try {
    console.log("🔍 Parsing Claude response...");
    console.log("Raw response:", response.substring(0, 200) + "...");

    try {
      // Try JSON format first
      const jsonMatch =
        response.match(/```json\s*([\s\S]*?)\s*```/) ||
        response.match(/\[\s*{\s*"prompt":/);

      if (jsonMatch) {
        let jsonText = jsonMatch[1] || response;

        jsonText = jsonText
          .replace(/^[\s\S]*?\[/, "[")
          .replace(/\][\s\S]*$/, "]");

        const jsonData = JSON.parse(jsonText);

        if (
          Array.isArray(jsonData) &&
          jsonData.length > 0 &&
          jsonData[0].prompt
        ) {
          console.log(
            "✅ JSON format detected, parsed:",
            jsonData.length,
            "prompts"
          );
          return {
            prompts: jsonData,
            fullResponse: response,
            jsonData: jsonData,
          };
        }
      }

      throw new Error("JSON pattern not found, trying text parsing");
    } catch (jsonError) {
      console.log("⚠️ JSON parsing failed, trying text parsing...");

      // Enhanced text parsing for Ad Creatives
      const prompts = [];

      // Split by common prompt separators
      const sections = response.split(
        /(?:Prompt \d+|Ad Creative Prompt \d+|Image \d+|Version \d+)/i
      );

      if (sections.length > 1) {
        // Multiple prompts detected
        for (let i = 1; i < sections.length; i++) {
          const section = sections[i].trim();
          if (section) {
            const promptData = parseIndividualPrompt(section, i);
            prompts.push(promptData);
          }
        }
      } else {
        // Single prompt - try to extract Ad Creatives
        const promptData = parseIndividualPrompt(response, 1);
        prompts.push(promptData);
      }

      console.log(
        "✅ Text parsing completed:",
        prompts.length,
        "prompts found"
      );
      return {
        prompts: prompts,
        fullResponse: response,
      };
    }
  } catch (error) {
    console.error("❌ Error parsing Claude response:", error);
    return {
      prompts: [
        {
          prompt: response,
          adCreativeA: "",
          adCreativeB: "",
        },
      ],
      fullResponse: response,
    };
  }
};

const parseIndividualPrompt = (text: string, index: number) => {
  console.log(`🔍 Parsing individual prompt ${index}...`);

  let prompt = text.trim();
  let adCreativeA = "";
  let adCreativeB = "";

  const adCreativeAMatch = text.match(
    /Ad Creative\s*A[:\-]?\s*([\s\S]*?)(?=Ad Creative\s*B|$)/i
  );
  const adCreativeBMatch = text.match(
    /Ad Creative\s*B[:\-]?\s*([\s\S]*?)(?=Ad Creative\s*A|Prompt|$)/i
  );

  if (adCreativeAMatch) {
    adCreativeA = adCreativeAMatch[1].trim();
    console.log(
      "✅ Found Ad Creative A:",
      adCreativeA.substring(0, 50) + "..."
    );
  }

  if (adCreativeBMatch) {
    adCreativeB = adCreativeBMatch[1].trim();
    console.log(
      "✅ Found Ad Creative B:",
      adCreativeB.substring(0, 50) + "..."
    );
  }

  // Method 2: Look for pattern "A:" and "B:" or "Version A" and "Version B"
  if (!adCreativeA && !adCreativeB) {
    const versionAMatch = text.match(
      /(?:Version\s*A|A[:\-])\s*([\s\S]*?)(?=Version\s*B|B[:\-]|$)/i
    );
    const versionBMatch = text.match(
      /(?:Version\s*B|B[:\-])\s*([\s\S]*?)(?=Version\s*A|A[:\-]|$)/i
    );

    if (versionAMatch) {
      adCreativeA = versionAMatch[1].trim();
      console.log("✅ Found Version A:", adCreativeA.substring(0, 50) + "...");
    }

    if (versionBMatch) {
      adCreativeB = versionBMatch[1].trim();
      console.log("✅ Found Version B:", adCreativeB.substring(0, 50) + "...");
    }
  }

  // Method 3: Look for numbered variations
  if (!adCreativeA && !adCreativeB) {
    const variation1Match = text.match(
      /(?:Variation\s*1|1[:\-\.])\s*([\s\S]*?)(?=Variation\s*2|2[:\-\.]|$)/i
    );
    const variation2Match = text.match(
      /(?:Variation\s*2|2[:\-\.])\s*([\s\S]*?)(?=Variation\s*1|1[:\-\.]|$)/i
    );

    if (variation1Match) {
      adCreativeA = variation1Match[1].trim();
      console.log(
        "✅ Found Variation 1 as Ad Creative A:",
        adCreativeA.substring(0, 50) + "..."
      );
    }

    if (variation2Match) {
      adCreativeB = variation2Match[1].trim();
      console.log(
        "✅ Found Variation 2 as Ad Creative B:",
        adCreativeB.substring(0, 50) + "..."
      );
    }
  }

  // Method 4: If still no Ad Creatives found, try to split main content
  if (!adCreativeA && !adCreativeB && text.length > 500) {
    const midPoint = Math.floor(text.length / 2);
    const splitPoint = text.indexOf("\n", midPoint);

    if (splitPoint > 0) {
      adCreativeA = text.substring(0, splitPoint).trim();
      adCreativeB = text.substring(splitPoint).trim();
      console.log("✅ Split content into A and B at midpoint");
    }
  }

  // Clean up the main prompt (remove Ad Creative sections)
  let cleanPrompt = prompt;
  if (adCreativeA || adCreativeB) {
    cleanPrompt = prompt
      .replace(/Ad Creative\s*A[:\-]?\s*[\s\S]*?(?=Ad Creative\s*B|$)/i, "")
      .replace(/Ad Creative\s*B[:\-]?\s*[\s\S]*$/i, "")
      .replace(/Version\s*A[:\-]?\s*[\s\S]*?(?=Version\s*B|$)/i, "")
      .replace(/Version\s*B[:\-]?\s*[\s\S]*$/i, "")
      .trim();
  }

  const result = {
    prompt: cleanPrompt || prompt,
    adCreativeA: adCreativeA,
    adCreativeB: adCreativeB,
  };

  console.log("📋 Parsed prompt result:");
  console.log("  Main prompt:", result.prompt.substring(0, 100) + "...");
  console.log("  Ad Creative A:", result.adCreativeA ? "FOUND" : "NOT FOUND");
  console.log("  Ad Creative B:", result.adCreativeB ? "FOUND" : "NOT FOUND");

  return result;
};
// Convert image URL to base64
const convertUrlToBase64 = async (imageUrl: string): Promise<string> => {
  // Return immediately if already base64
  if (imageUrl.startsWith("data:")) {
    console.log("🔄 Image already in base64 format");
    return imageUrl;
  }

  console.log(
    "🔄 Converting URL to base64:",
    imageUrl.substring(0, 100) + "..."
  );

  // Method 1: Try backend proxy first
  try {
    console.log("🔄 Attempting backend proxy conversion...");
    const response = await fetch(API_ENDPOINTS.PROXY_IMAGE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    const responseText = await response.text();
    console.log(`📡 Backend proxy response status: ${response.status}`);

    if (response.ok) {
      const data = JSON.parse(responseText);
      if (data.success && data.base64) {
        console.log(
          `✅ Backend proxy conversion successful, size: ${Math.round(
            data.size / 1024
          )}KB`
        );
        return data.base64;
      } else {
        throw new Error(
          `Backend returned success=false: ${data.error || "Unknown error"}`
        );
      }
    } else {
      const errorData = JSON.parse(responseText).catch(() => ({
        error: responseText,
      }));
      throw new Error(
        `Backend proxy failed: ${response.status} - ${
          errorData.error || errorData.message || responseText
        }`
      );
    }
  } catch (backendError) {
    console.log("⚠️ Backend proxy failed:", backendError.message);

    // Method 2: Try direct image proxy as fallback
    try {
      console.log("🔄 Trying direct image proxy...");
      const encodedUrl = encodeURIComponent(imageUrl);
      const proxyUrl = `${API_ENDPOINTS.PROXY_IMAGE_DIRECT}?url=${encodedUrl}`;

      const img = new Image();
      img.crossOrigin = "anonymous";

      return new Promise((resolve, reject) => {
        img.onload = function () {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              throw new Error("Could not get canvas context");
            }

            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "medium";
            ctx.drawImage(img, 0, 0);

            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            console.log("✅ Direct proxy + canvas conversion successful");
            resolve(dataUrl);
          } catch (error) {
            console.error("❌ Canvas conversion failed:", error);
            reject(error);
          }
        };

        img.onerror = function (error) {
          console.error("❌ Direct proxy image load failed:", error);
          reject(new Error("Direct proxy image load failed"));
        };

        img.src = proxyUrl;

        // Timeout after 15 seconds
        setTimeout(() => {
          reject(new Error("Direct proxy timeout"));
        }, 15000);
      });
    } catch (directProxyError) {
      console.log("⚠️ Direct proxy also failed:", directProxyError.message);

      // Method 3: Try direct fetch (will likely fail due to CORS but let's try)
      try {
        console.log("🔄 Trying direct fetch as last resort...");

        const response = await fetch(imageUrl, {
          mode: "cors",
          headers: {
            Accept: "image/*",
          },
          credentials: "omit",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log("🔄 Blob created, size:", blob.size, "type:", blob.type);

        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            console.log("✅ Direct fetch conversion successful");
            resolve(result);
          };
          reader.onerror = () => reject(new Error("FileReader failed"));
          reader.readAsDataURL(blob);
        });
      } catch (directFetchError) {
        console.log(
          "⚠️ Direct fetch also failed (expected due to CORS):",
          directFetchError.message
        );

        console.log("🔄 All conversion methods failed, returning original URL");
        return imageUrl;
      }
    }
  }
};

const USE_MOCK_CLAUDE = false;
const USE_MOCK_CHATGPT = false;

const generateImageWithChatGPT = async (
  prompt: string,
  selectedSize: string = "Square"
): Promise<string> => {
  console.log(`\n=== OPENAI API DEBUG ===`);
  console.log(`📏 Prompt length being sent: ${prompt.length} characters`);
  console.log(`📐 Selected size: ${selectedSize}`);
  console.log(`📝 Prompt preview (first 500 chars):`, prompt.substring(0, 500));
  console.log(`==========================\n`);

  if (USE_MOCK_CHATGPT) {
    // Simulate API delay
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );

    const placeholderImages = [
      "https://www.topofferinsight.com/wp-content/uploads/2025/05/noxus-rif-img-19-2048x2048.jpg",
      "https://www.topofferinsight.com/wp-content/uploads/2025/05/noxus-rif-img-08.jpg",
      "https://www.topofferinsight.com/wp-content/uploads/2025/05/noxus-rif-img-09.jpg",
      "https://www.topofferinsight.com/wp-content/uploads/2025/05/noxus-rif-img-17.png",
      "https://www.topofferinsight.com/wp-content/uploads/2025/05/noxus-rif-img-03.jpg",
      "https://www.topofferinsight.com/wp-content/uploads/2025/05/noxus-rif-img-05-2048x2048.jpg",
      "https://www.topofferinsight.com/wp-content/uploads/2025/05/noxus-rif-img-14-2048x2048.jpg",
    ];

    const randomImage =
      placeholderImages[Math.floor(Math.random() * placeholderImages.length)];

    // Convert mock image to base64 for testing
    try {
      const base64Image = await convertUrlToBase64(randomImage);
      return base64Image;
    } catch (error) {
      console.error("❌ Mock image conversion failed:", error);
      return randomImage; // Return URL as fallback
    }
  }

  try {
    const response = await fetch(API_ENDPOINTS.CHATGPT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        selectedSize: selectedSize,
        model: "gpt-image-1",
        n: 1,
        quality: "low",
        convertToBase64: false,
      }),
    });

    const responseText = await response.text();
    console.log(`📡 ChatGPT API response status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ ChatGPT API Error ${response.status}:`, responseText);
      throw new Error(
        `ChatGPT API error: ${response.status} ${response.statusText}`
      );
    }

    const data = JSON.parse(responseText);
    const imageResult = data.data?.[0];

    if (!imageResult) {
      throw new Error("No image data returned from API");
    }

    console.log(`✅ ChatGPT API Success`);
    console.log(`🔍 Image result:`, {
      hasUrl: !!imageResult.url,
      hasOriginalUrl: !!imageResult.original_url,
      converted: imageResult.converted,
      isBase64: imageResult.url?.startsWith("data:"),
      conversionFailed: data.conversion_failed,
    });

    // Check if backend successfully converted to base64
    if (
      imageResult.converted &&
      imageResult.url &&
      imageResult.url.startsWith("data:")
    ) {
      console.log(
        `✅ Backend converted to base64, size: ${Math.round(
          imageResult.size / 1024
        )}KB`
      );
      return imageResult.url;
    }

    // Backend didn't convert or conversion failed - try frontend conversion
    const imageUrl = imageResult.url || imageResult.original_url;
    if (!imageUrl) {
      throw new Error("No image URL found in response");
    }

    console.log(
      `🔄 Backend conversion failed/skipped, trying frontend conversion...`
    );
    console.log(`🔗 Original URL: ${imageUrl.substring(0, 100)}...`);

    // Try to convert using our convertUrlToBase64 function
    try {
      const base64Image = await convertUrlToBase64(imageUrl);

      if (base64Image.startsWith("data:")) {
        console.log(`✅ Frontend conversion to base64 successful`);
        return base64Image;
      } else {
        console.log(
          `⚠️ Frontend conversion returned URL (probably failed), using as-is`
        );
        return base64Image; // Still return it, might be the original URL
      }
    } catch (conversionError) {
      console.error("❌ Frontend base64 conversion failed:", conversionError);
      console.log("🔄 Returning original URL as final fallback");
      return imageUrl; // Return original URL as last resort
    }
  } catch (error) {
    console.error("❌ Error calling ChatGPT API:", error);

    // Return error placeholder as base64
    const errorPlaceholder =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZTZlNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNDAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNkNjZkMDAiPkFQSSBFcnJvcjwvdGV4dD48dGV4dCB4PSI1MCUiIHk9IjYwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDY2ZDAwIj5DbGljayB0byByZXRyeTwvdGV4dD48L3N2Zz4=";

    console.log("🔄 Returning error placeholder");
    return errorPlaceholder;
  }
};

// 4. ADD SafeImage Component (insert anywhere before the main export)
const SafeImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  selectedImages?: any[];
  selectedSessions?: any[];
}> = ({
  src,
  alt,
  className,
  style,
  onClick,
  selectedImages,
  selectedSessions,
}) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Update src when prop changes
  useEffect(() => {
    setImageSrc(src);
    setHasError(false);
    setIsLoading(false);
    setRetryCount(0);
  }, [src]);

  const handleImageError = async () => {
    if (hasError || retryCount >= 2) {
      // Already tried multiple times, give up
      console.log("🔄 Max retries reached, showing error placeholder");
      setImageSrc(
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
      );
      setIsLoading(false);
      setHasError(true);
      return;
    }

    console.log(
      `🔄 Image failed to load (retry ${retryCount + 1}/2), trying to convert:`,
      imageSrc.substring(0, 100) + "..."
    );
    setIsLoading(true);
    setHasError(true);
    setRetryCount((prev) => prev + 1);

    try {
      // Try to convert using backend proxy
      const base64Image = await convertUrlToBase64(imageSrc);

      if (base64Image !== imageSrc) {
        if (base64Image.startsWith("data:")) {
          setImageSrc(base64Image);
          setHasError(false);
          console.log(
            "✅ SafeImage: Successfully converted failed image to base64"
          );
        } else {
          // Conversion returned a different URL, try it
          setImageSrc(base64Image);
          setHasError(false);
          console.log(
            "✅ SafeImage: Got different URL from conversion, trying it"
          );
        }
      } else {
        throw new Error("Conversion returned same URL");
      }
    } catch (error) {
      console.error("❌ SafeImage: Failed to convert image:", error);

      // Try direct proxy as final attempt
      if (!imageSrc.includes("/api/proxy-image-direct")) {
        try {
          const API_BASE_URL = "http://localhost:3001";
          const encodedUrl = encodeURIComponent(imageSrc);
          const proxyUrl = `${API_BASE_URL}/api/proxy-image-direct?url=${encodedUrl}`;

          console.log("🔄 SafeImage: Trying direct proxy as final attempt");
          setImageSrc(proxyUrl);
          setHasError(false);
        } catch (proxyError) {
          console.error("❌ SafeImage: Direct proxy also failed:", proxyError);
          // Will show error placeholder on next error
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
    console.log("✅ SafeImage: Image loaded successfully");
  };

  return (
    <div style={{ position: "relative", ...style }} className={className}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            borderRadius: "4px",
            padding: "8px",
          }}
        >
          <div
            className="loading-spinner"
            style={{
              width: "24px",
              height: "24px",
              border: "2px solid #f3f3f3",
              borderTop: "2px solid #3498db",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: isLoading ? 0.7 : 1,
          transition: "opacity 0.3s ease",
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
        onError={handleImageError}
        onLoad={handleImageLoad}
        onClick={onClick}
      />
      {hasError && retryCount >= 2 && (
        <div
          style={{
            position: "absolute",
            bottom: "4px",
            right: "4px",
            fontSize: "10px",
            color: "#999",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            padding: "2px 4px",
            borderRadius: "2px",
          }}
        >
          Failed to load
        </div>
      )}
    </div>
  );
};

export const ElementDefaultScreen = (): JSX.Element => {
  // Component states
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestAbortControllers = useRef(new Map<string, AbortController>());
  const [imageSizes, setImageSizes] = useState<{
    Square: number;
    Portrait: number;
    Landscape: number;
  }>({
    Square: 0,
    Portrait: 0,
    Landscape: 0,
  });
  const [numberOfImages, setNumberOfImages] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<string>("Low");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [promptText, setPromptText] = useState<string>("");
  const [instructionsText, setInstructionsText] = useState<string>("");
  const [storageReady, setStorageReady] = useState(false);
  const [currentLoadingPrompt, setCurrentLoadingPrompt] = useState<string>("");
  const [expandedGrid, setExpandedGrid] = useState<boolean>(false);
  const [baseGridCount, setBaseGridCount] = useState<number>(8);

  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Store complete session data with all images
  const [selectedSessions, setSelectedSessions] = useState<
    Array<{
      sessionId: string;
      clickedAt: number;
      currentImageIndex: number;
      describe?: string;
      list: Array<{
        imageBase64: string;
        prompt: string;
        claudeResponse?: string;
        timestamp: string;
        size: string;
        quality: string;
        AdCreativeA?: string;
        AdCreativeB?: string;
      }>;
    }>
  >([]);

  // For compatibility with existing code, maintain a flattened list of selected images
  const [selectedImages, setSelectedImages] = useState<
    Array<{
      imageUrl: string;
      clickedAt: number;
      prompt?: string;
      claudeResponse?: string;
      size?: string;
      quality?: string;
      sessionId?: string;
      imageIndex?: number;
    }>
  >([]);

  // State for the currently viewed image (for gallery mode)
  const [currentViewImageIndex, setCurrentViewImageIndex] = useState<
    number | null
  >(null);

  // State for tracking the current session being viewed
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionImageIndex, setCurrentSessionImageIndex] =
    useState<number>(0);

  // State for prompt expand
  const [promptExpanded, setPromptExpanded] = useState<boolean>(false);

  // State for controlling the grid size
  const [gridItemCount, setGridItemCount] = useState<number>(8);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesContainerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionButtonRef = useRef<HTMLImageElement>(null);
  const historySidebarRef = useRef<HTMLDivElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const promptTextRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLDivElement>(null);

  // Size and quality options
  const sizeOptions = [
    {
      id: "Square",
      label: "Square",
      className: "size-option-item menuitem",
      textClassName: "text-wrapper-2",
    },
    {
      id: "Portrait",
      label: "Portrait",
      className: "size-option-item menuitem div-wrapper",
      textClassName: "text-wrapper-3",
    },
    {
      id: "Landscape",
      label: "Landscape",
      className: "size-option-item menuitem menuitem-2",
      textClassName: "text-wrapper-4",
    },
  ];

  const qualityOptions = [
    {
      id: "High",
      label: "High",
      className: "menuitem menuitem-3",
      textClassName: "text-wrapper-5",
    },
    {
      id: "Medium",
      label: "Medium",
      className: "menuitem menuitem-4",
      textClassName: "text-wrapper-6",
    },
    {
      id: "Low",
      label: "Low",
      className: "menuitem menuitem-5",
      textClassName: "text-wrapper-7",
    },
  ];

  const suggestionItems = [
    "Logo",
    "Business Card",
    "Furniture Design",
    "Handbag matching outfit",
    "Speaker Ad",
    "Sneakers design",
    "3D City",
    "Glass Speaker",
    "Chocolate Bar",
  ];

  const getTotalSelectedImages = (): number => {
    return imageSizes.Square + imageSizes.Portrait + imageSizes.Landscape;
  };

  const canIncreaseSize = (sizeType: string): boolean => {
    const currentTotal = getTotalSelectedImages();
    return currentTotal < numberOfImages;
  };

  const generateImageSizesString = (): string => {
    const totalSelected = getTotalSelectedImages();
    const totalNeeded = numberOfImages;

    if (totalSelected === 0) {
      return "auto";
    }

    const sizesArray: string[] = [];

    for (let i = 0; i < imageSizes.Square; i++) {
      sizesArray.push("Square");
    }
    for (let i = 0; i < imageSizes.Portrait; i++) {
      sizesArray.push("Portrait");
    }
    for (let i = 0; i < imageSizes.Landscape; i++) {
      sizesArray.push("Landscape");
    }

    const remaining = totalNeeded - totalSelected;
    for (let i = 0; i < remaining; i++) {
      sizesArray.push("auto");
    }

    return sizesArray.join(", ");
  };

  useEffect(() => {
    const currentTotal = getTotalSelectedImages();
    if (currentTotal > numberOfImages) {
      setImageSizes({
        Square: 0,
        Portrait: 0,
        Landscape: 0,
      });
    }
  }, [numberOfImages]);

  useEffect(() => {
    fetch("/instructions.txt")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load instructions.txt");
        }
        return response.text();
      })
      .then((text) => {
        setInstructionsText(text);
        console.log("Instructions loaded successfully");
      })
      .catch((error) => {
        console.error("Error loading instructions:", error);
      });
  }, []);

  useEffect(() => {
    const initStorage = async () => {
      try {
        await storageManager.init();
        await StorageMigration.migrateFromOldLocalStorage(storageManager);
        setStorageReady(true);
        console.log("✅ Storage initialized successfully");
      } catch (error) {
        console.error("❌ Storage initialization failed:", error);
        setStorageReady(true); // Continue with fallback
      }
    };

    initStorage();
  }, []);

  const getFirst10Words = (text: string): string => {
    return text.split(" ").slice(0, 10).join(" ") + "...";
  };

  const cancelImageGeneration = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Chỉ hủy phiên hiện tại
    if (currentSessionId) {
      const controller = requestAbortControllers.current.get(currentSessionId);
      if (controller) {
        controller.abort();
        requestAbortControllers.current.delete(currentSessionId);
      }
    }

    setIsLoading(false);
    setLoadingStatus("");
    setCurrentLoadingPrompt("");
  };

  const cancelSpecificSession = (sessionId: string) => {
    const controller = requestAbortControllers.current.get(sessionId);
    if (controller) {
      controller.abort();
      requestAbortControllers.current.delete(sessionId);
      console.log(`Cancelled session: ${sessionId}`);
    }
  };

  const editPromptFromLoading = () => {
    if (currentLoadingPrompt && textareaRef.current) {
      textareaRef.current.value = currentLoadingPrompt;
      setPromptText(currentLoadingPrompt);

      // Trigger input event để cập nhật height
      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
      adjustHeight();

      console.log("📝 Prompt moved to input field");
    }
  };

  const handleFormSubmit = async () => {
    if (!promptText.trim()) return;

    if (!instructionsText) {
      console.error("Instructions have not been loaded yet");
      alert("Please wait for instructions to load");
      return;
    }

    // Tạo sessionId unique cho phiên này
    const sessionId = `session-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Tạo AbortController riêng cho phiên này
    const controller = new AbortController();
    requestAbortControllers.current.set(sessionId, controller);
    const { signal } = controller;

    const currentPromptText = promptText.trim();
    setCurrentLoadingPrompt(currentPromptText);
    setCurrentSessionId(sessionId);

    // Reset UI state
    setPromptText("");
    setUploadedImages([]);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
      requestAnimationFrame(() => {
        adjustHeight();
      });
    }

    setIsLoading(true);
    setLoadingStatus("Generating prompts...");

    let count = 0;
    setCountdown(count);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    countdownRef.current = setInterval(() => {
      count += 1;
      setCountdown(count);
    }, 1000);

    try {
      const outputCount = numberOfImages;
      const imageSizesString = generateImageSizesString();

      const userPrompt = `${currentPromptText}\n\nOutput: ${outputCount}\n\nImage sizes: ${imageSizesString}`;

      console.log("Generated image sizes string:", imageSizesString);
      console.log("Sending to Claude API...");

      let claudeResponseText;
      let parsedResponse;

      if (USE_MOCK_CLAUDE) {
        // Mock code không thay đổi
        const mockClaudeResponse = [
          /* your mock data here */
        ];
        claudeResponseText = JSON.stringify(mockClaudeResponse);
        parsedResponse = {
          prompts: mockClaudeResponse.slice(0, outputCount),
          fullResponse: claudeResponseText,
        };
      } else {
        // Kiểm tra nếu đã bị hủy
        if (signal.aborted) {
          console.log("Request đã bị hủy trước khi gọi Claude API");
          throw new DOMException("Aborted", "AbortError");
        }

        // Gọi Claude API với signal
        const response = await fetch(API_ENDPOINTS.CLAUDE_CACHED, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8000,
            user_prompt: userPrompt,
            enable_caching: true,
            session_id: sessionId,
          }),
          signal, // Truyền signal
        });

        // Kiểm tra lại nếu đã bị hủy
        if (signal.aborted) {
          console.log("Request đã bị hủy sau khi gọi Claude API");
          throw new DOMException("Aborted", "AbortError");
        }

        if (!response.ok) {
          throw new Error(
            `API error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        claudeResponseText =
          data.content?.[0]?.text || "No response from Claude";
        parsedResponse = parseClaudeResponse(claudeResponseText);
      }

      // Kiểm tra lại nếu đã bị hủy
      if (signal.aborted) {
        console.log("Request đã bị hủy sau khi parse Claude response");
        throw new DOMException("Aborted", "AbortError");
      }

      setLoadingStatus("Generating images...");

      console.log(
        `Starting concurrent API calls for ${parsedResponse.prompts.length} images...`
      );

      // Tạo array các promises với signal
      const imagePromises = parsedResponse.prompts.map((promptData, index) => {
        const originalPrompt = promptData.prompt;
        const imageSize = getImageSizeForIndex(index);

        // Kiểm tra nếu đã bị hủy
        if (signal.aborted) {
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        }

        // Gọi OpenAI API với signal
        return generateImageWithChatGPT(promptData.prompt, imageSize, signal)
          .then((imageBase64) => {
            // Kiểm tra nếu đã bị hủy
            if (signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }

            console.log(
              `Image ${index + 1} (${imageSize}) completed:`,
              imageBase64.startsWith("data:") ? "SUCCESS" : "FAILED"
            );

            return {
              imageBase64: imageBase64,
              prompt: promptData.prompt,
              claudeResponse: claudeResponseText,
              timestamp: new Date().toISOString(),
              size: imageSize,
              quality: selectedQuality,
              AdCreativeA: promptData.adCreativeA,
              AdCreativeB: promptData.adCreativeB,
              isSuccess:
                imageBase64.startsWith("data:") &&
                !imageBase64.includes(
                  "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4"
                ),
            };
          })
          .catch((error) => {
            if (error.name === "AbortError") {
              throw error; // Re-throw để xử lý ở Promise.all
            }

            // Xử lý lỗi khác
            return {
              imageBase64:
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg==",
              prompt: promptData.prompt,
              claudeResponse: claudeResponseText,
              timestamp: new Date().toISOString(),
              size: imageSize,
              quality: selectedQuality,
              AdCreativeA: promptData.adCreativeA,
              AdCreativeB: promptData.adCreativeB,
              isSuccess: false,
            };
          });
      });

      // Chờ tất cả ảnh hoàn thành hoặc bị hủy
      const sessionImages = await Promise.all(imagePromises);

      // Kiểm tra lại nếu đã bị hủy
      if (signal.aborted) {
        console.log("Request đã bị hủy sau khi tạo tất cả ảnh");
        throw new DOMException("Aborted", "AbortError");
      }

      console.log(`All ${sessionImages.length} images completed!`);

      // Lọc ảnh thành công
      const isSuccessfulImage = (img) => img.isSuccess;
      const successfulImages = sessionImages.filter(isSuccessfulImage);
      const failedImages = sessionImages.filter(
        (img) => !isSuccessfulImage(img)
      );

      console.log(
        `Successful images: ${successfulImages.length}/${sessionImages.length}`
      );
      console.log(
        `Failed images: ${failedImages.length}/${sessionImages.length}`
      );

      // Kiểm tra nếu không có ảnh thành công
      if (successfulImages.length === 0) {
        console.error("No successful images generated");
        setLoadingStatus("All images failed to generate");
        showNotification(
          "error",
          "Generation Failed!",
          "No images were successfully generated. Please try again."
        );
        return;
      }

      // Hiển thị thông báo nếu có ảnh lỗi
      if (failedImages.length > 0 && successfulImages.length > 0) {
        console.warn(`Partial success: ${failedImages.length} images failed`);
        showNotification(
          "warning",
          "Partial Success",
          `${successfulImages.length}/${sessionImages.length} images generated successfully.`
        );
      }

      // Lưu session với ảnh thành công
      try {
        console.log(
          "Attempting to save session with successful images only..."
        );

        await storageManager.saveSession({
          sessionId,
          describe: currentPromptText,
          images: successfulImages,
        });

        console.log("Session saved successfully!");
      } catch (storageError) {
        console.error("All storage methods failed:", storageError);
        showNotification(
          "error",
          "Storage Full!",
          "Your images were generated but couldn't be saved due to storage limits."
        );
      }

      // Tạo session mới cho UI
      const newSession = {
        sessionId,
        clickedAt: Date.now(),
        currentImageIndex: 0,
        describe: currentPromptText,
        list: successfulImages,
      };

      setSelectedSessions((prevSessions) => [newSession, ...prevSessions]);

      // Chuyển đổi ảnh sang blob URLs
      if (successfulImages.length > 0) {
        const convertedImages = await Promise.all(
          successfulImages.map(async (img) => {
            try {
              const compressed = await ImageCompressor.compressImage(
                img.imageBase64
              );
              const blobUrl = URL.createObjectURL(compressed.blob);

              return {
                ...img,
                imageBase64: blobUrl,
                originalBase64: img.imageBase64,
                isBlob: true,
              };
            } catch (error) {
              console.warn("Failed to convert to blob, using base64:", error);
              return {
                ...img,
                isBlob: false,
              };
            }
          })
        );

        // Cập nhật session với ảnh đã chuyển đổi
        const updatedSession = {
          sessionId,
          clickedAt: Date.now(),
          currentImageIndex: 0,
          describe: currentPromptText,
          list: convertedImages,
        };

        setSelectedSessions((prevSessions) => [
          updatedSession,
          ...prevSessions,
        ]);

        // Thêm ảnh đầu tiên vào grid
        const firstImageObj = {
          imageUrl: convertedImages[0].imageBase64,
          clickedAt: Date.now(),
          prompt: convertedImages[0].prompt,
          size: convertedImages[0].size,
          quality: convertedImages[0].quality,
          sessionId: sessionId,
          imageIndex: 0,
          claudeResponse: claudeResponseText,
          AdCreativeA: convertedImages[0].AdCreativeA,
          AdCreativeB: convertedImages[0].AdCreativeB,
        };

        setSelectedImages((prevImages) => [
          firstImageObj,
          ...prevImages.slice(0, gridItemCount - 1),
        ]);
      }

      window.dispatchEvent(new Event("historyUpdated"));
    } catch (error) {
      // Kiểm tra nếu lỗi là do hủy
      if (error.name === "AbortError") {
        console.log("🛑 Image generation cancelled by user");
        return; // Thoát mà không hiển thị lỗi
      }

      console.error("Error calling APIs:", error);
      setLoadingStatus("Error occurred");
      showNotification("error", "API Error!", error.message);
    } finally {
      // Dọn dẹp
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      // Xóa controller khỏi map
      requestAbortControllers.current.delete(sessionId);

      setIsLoading(false);
      setLoadingStatus("");
      setCurrentLoadingPrompt("");
    }
  };

  // Hàm helper để hiển thị thông báo
  const showNotification = (type, title, message) => {
    const notification = document.createElement("div");
    notification.innerHTML = `
    <div style="
      position: fixed; 
      top: 20px; 
      right: 20px; 
      background: ${
        type === "error"
          ? "#ff6b6b"
          : type === "warning"
          ? "#f39c12"
          : "#4CAF50"
      }; 
      color: white; 
      padding: 15px 20px; 
      border-radius: 8px; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
    ">
      <strong>${title}</strong><br>
      ${message}<br>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: white; 
        color: ${
          type === "error"
            ? "#ff6b6b"
            : type === "warning"
            ? "#f39c12"
            : "#4CAF50"
        }; 
        border: none; 
        padding: 5px 10px; 
        border-radius: 4px; 
        margin-top: 8px;
        cursor: pointer;
      ">OK</button>
    </div>
  `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        document.body.removeChild(notification);
      }
    }, 5000);
  };

  // Handle keypress for form submission
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && promptText.trim() && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit();
    }
  };

  const navigateImageThumbnail = (
    index: number,
    direction: "prev" | "next",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    const currentImage = selectedImages[index];
    if (!currentImage?.sessionId) return;

    const session = selectedSessions.find(
      (s) => s.sessionId === currentImage.sessionId
    );
    if (!session || session.list.length <= 1) return;

    let currentImageIndexInSession = -1;

    if (currentImage.imageIndex !== undefined) {
      currentImageIndexInSession = currentImage.imageIndex;
    } else {
      for (let i = 0; i < session.list.length; i++) {
        if (
          session.list[i].imageBase64 === currentImage.imageUrl &&
          session.list[i].prompt === currentImage.prompt
        ) {
          currentImageIndexInSession = i;
          break;
        }
      }

      if (currentImageIndexInSession === -1) {
        currentImageIndexInSession = session.list.findIndex(
          (img) => img.imageBase64 === currentImage.imageUrl
        );
      }
    }

    if (currentImageIndexInSession === -1) return;

    const totalImagesInSession = session.list.length;
    let nextImageIndexInSession;

    if (direction === "prev") {
      nextImageIndexInSession =
        currentImageIndexInSession === 0
          ? totalImagesInSession - 1
          : currentImageIndexInSession - 1;
    } else {
      nextImageIndexInSession =
        currentImageIndexInSession === totalImagesInSession - 1
          ? 0
          : currentImageIndexInSession + 1;
    }

    // Get the next image data from the session
    const nextImageData = session.list[nextImageIndexInSession];

    // Create new image object for the next image in sequence
    const nextImageObject = {
      imageUrl: nextImageData.imageBase64,
      clickedAt: Date.now(),
      prompt: nextImageData.prompt,
      size: nextImageData.size,
      quality: nextImageData.quality,
      sessionId: currentImage.sessionId,
      imageIndex: nextImageIndexInSession,
    };

    // Replace the current image with the next one at the same position
    const updatedImages = [...selectedImages];
    updatedImages[index] = nextImageObject;
    setSelectedImages(updatedImages);
  };

  const calculateOptimalGridSize = useCallback(() => {
    if (!gridContainerRef.current) return;

    const container = gridContainerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = window.innerHeight - 200;

    if (containerWidth < 500) {
      setBaseGridCount(4);
    } else {
      const divisor = Math.max(1, Math.floor(containerWidth / 300));
      const itemWidth = containerWidth / divisor;

      const itemsPerRow = Math.max(1, Math.floor(containerWidth / itemWidth));

      const itemHeight = itemWidth;
      const rowsVisible = Math.max(2, Math.ceil(containerHeight / itemHeight));

      const optimalCount = itemsPerRow * rowsVisible;
      setBaseGridCount(Math.max(4, Math.min(optimalCount, 50)));
    }

    if (!expandedGrid) {
      setGridItemCount(baseGridCount);
    }
  }, [expandedGrid]);

  useEffect(() => {
    calculateOptimalGridSize();
    window.addEventListener("resize", calculateOptimalGridSize);
    return () => window.removeEventListener("resize", calculateOptimalGridSize);
  }, [calculateOptimalGridSize]);

  // Recalculate grid size when images change
  useEffect(() => {
    if (gridContainerRef.current) {
      calculateOptimalGridSize();
    }
  }, [selectedImages, calculateOptimalGridSize]);

  // Handle history item click - store the complete session data
  const handleHistoryItemClick = (item: any) => {
    if (item.list && item.list.length > 0) {
      // Kiểm tra session đã tồn tại
      const sessionIndex = selectedSessions.findIndex(
        (s) => s.sessionId === item.id
      );

      if (sessionIndex === -1) {
        // Thêm session mới
        setSelectedSessions((prevSessions) => [
          {
            sessionId: item.id,
            clickedAt: Date.now(),
            currentImageIndex: 0,
            describe: item.describe,
            list: [...item.list],
          },
          ...prevSessions,
        ]);

        // Thêm ảnh đầu tiên vào grid
        const firstImage = item.list[0];
        setSelectedImages((prevImages) => {
          const newImageObj = {
            imageUrl: firstImage.imageBase64,
            clickedAt: Date.now(),
            prompt: firstImage.prompt,
            size: firstImage.size,
            quality: firstImage.quality,
            sessionId: item.id,
            imageIndex: 0,
          };

          // Thêm vào đầu, KHÔNG cắt theo gridItemCount
          const updatedImages = [newImageObj, ...prevImages];

          // Tự động mở rộng grid nếu cần
          if (updatedImages.length > gridItemCount) {
            setExpandedGrid(true);
            setGridItemCount(updatedImages.length);
          }

          return updatedImages;
        });
      } else {
        console.warn(`Session ${item.id} đã tồn tại trong selectedSessions`);
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (showUserDropdown && !event.target.closest(".background-wrapper")) {
        setShowUserDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserDropdown]);

  // Remove a selected image
  const removeSelectedImage = (indexToRemove: number) => {
    const imageToRemove = selectedImages[indexToRemove];

    setSelectedImages((prevImages) =>
      prevImages.filter((_, index) => index !== indexToRemove)
    );

    if (imageToRemove.sessionId) {
      const sessionImages = selectedImages.filter(
        (img) => img.sessionId === imageToRemove.sessionId
      );

      if (sessionImages.length === 1) {
        setSelectedSessions((prevSessions) =>
          prevSessions.filter(
            (session) => session.sessionId !== imageToRemove.sessionId
          )
        );
      }
    }

    if (currentViewImageIndex === indexToRemove) {
      setCurrentViewImageIndex(null);
      setCurrentSessionId(null);
    } else if (
      currentViewImageIndex !== null &&
      currentViewImageIndex > indexToRemove
    ) {
      setCurrentViewImageIndex(currentViewImageIndex - 1);
    }
  };

  // Clear all images
  const clearAllImages = () => {
    setSelectedImages([]);
    setSelectedSessions([]);
    setCurrentViewImageIndex(null);
    setCurrentSessionId(null);
  };

  // View image in fullscreen mode
  const viewImage = (index: number) => {
    const selectedImage = selectedImages[index];
    setCurrentViewImageIndex(index);
    setPromptExpanded(false);

    if (selectedImage && selectedImage.sessionId) {
      setCurrentSessionId(selectedImage.sessionId);

      const session = selectedSessions.find(
        (s) => s.sessionId === selectedImage.sessionId
      );
      if (session) {
        if (selectedImage.imageIndex !== undefined) {
          setCurrentSessionImageIndex(selectedImage.imageIndex);
        } else {
          const imageIndex = session.list.findIndex(
            (img) => img.imageBase64 === selectedImage.imageUrl
          );
          if (imageIndex !== -1) {
            setCurrentSessionImageIndex(imageIndex);
          }
        }
      }
    }

    setTimeout(checkPromptHeight, 100);
  };

  // Close image viewer
  const closeImageViewer = () => {
    setCurrentViewImageIndex(null);
    setCurrentSessionId(null);
    setPromptExpanded(false);
  };

  // Navigate to next/previous image within the same session
  const navigateImage = (direction: "prev" | "next") => {
    if (currentSessionId === null) return;

    const currentSession = selectedSessions.find(
      (s) => s.sessionId === currentSessionId
    );
    if (!currentSession || currentSession.list.length <= 1) return;

    let newIndex;
    if (direction === "prev") {
      newIndex =
        currentSessionImageIndex === 0
          ? currentSession.list.length - 1
          : currentSessionImageIndex - 1;
    } else {
      newIndex =
        currentSessionImageIndex === currentSession.list.length - 1
          ? 0
          : currentSessionImageIndex + 1;
    }

    setCurrentSessionImageIndex(newIndex);

    const newImageData = currentSession.list[newIndex];

    const existingImageIndex = selectedImages.findIndex(
      (img) =>
        img.sessionId === currentSessionId &&
        img.imageUrl === newImageData.imageBase64
    );

    if (existingImageIndex !== -1) {
      setCurrentViewImageIndex(existingImageIndex);
    }

    setPromptExpanded(false);
    setTimeout(checkPromptHeight, 100);
  };

  const hasMultipleInSession = (index: number): boolean => {
    const image = selectedImages[index];
    if (!image || !image.sessionId) return false;

    const session = selectedSessions.find(
      (s) => s.sessionId === image.sessionId
    );
    return session ? session.list.length > 1 : false;
  };

  // Check if prompt needs "Show more" button
  const checkPromptHeight = () => {
    if (promptTextRef.current) {
      const isOverflowing =
        promptTextRef.current.scrollHeight > promptTextRef.current.clientHeight;
      const showMoreBtn = document.getElementById("show-more-btn");

      if (showMoreBtn) {
        showMoreBtn.style.display = isOverflowing ? "block" : "none";
      }
    }
  };

  // Toggle prompt expand
  const togglePromptExpand = () => {
    setPromptExpanded(!promptExpanded);
  };

  // Add image to prompt
  const addImageToPrompt = (imageUrl: string) => {
    setUploadedImages((prev) => [...prev, imageUrl]);
  };

  // Edit prompt with text from image
  const editPrompt = (prompt: string = "") => {
    if (textareaRef.current && prompt) {
      textareaRef.current.value = prompt;
      setPromptText(prompt);
      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
      adjustHeight();
    }
  };

  // Download image
  const downloadImage = async (imageUrl: string) => {
    try {
      if (imageUrl.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `ai-image-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const response = await fetch(imageUrl, { mode: "cors" });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();

      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;

      const fileName = imageUrl.split("/").pop() || `image-${Date.now()}.jpg`;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading image:", error);

      window.open(imageUrl, "_blank");
    }
  };

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
  };

  const toggleHistorySidebar = () => {
    setShowHistorySidebar(!showHistorySidebar);
  };

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset về auto để tính toán chính xác
    textarea.style.height = "auto";
    textarea.style.overflowY = "hidden";

    requestAnimationFrame(() => {
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 126;
      const minHeight = 40;

      // Nếu textarea trống, set về minHeight
      if (!textarea.value.trim()) {
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
        return;
      }

      // Kiểm tra xem có xuống dòng không bằng cách so sánh với height của 1 dòng
      // Tạm thời set về minHeight để kiểm tra
      textarea.style.height = `${minHeight}px`;
      const isOverflowing = textarea.scrollHeight > minHeight;

      if (!isOverflowing) {
        // Nếu không overflow, giữ ở minHeight
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
      } else {
        // Nếu overflow, sử dụng scrollHeight
        textarea.style.height = "auto";
        const actualScrollHeight = textarea.scrollHeight;

        if (actualScrollHeight > maxHeight) {
          textarea.style.height = `${maxHeight}px`;
          textarea.style.overflowY = "auto";
        } else {
          textarea.style.height = `${actualScrollHeight}px`;
          textarea.style.overflowY = "hidden";
        }
      }
    });
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      if (!promptText.trim()) {
        // Nếu textarea trống, set height cố định
        textareaRef.current.style.height = "40px";
        textareaRef.current.style.overflowY = "hidden";
      } else {
        // Nếu có nội dung, gọi hàm adjustHeight
        adjustHeight();
      }
    }
  }, [promptText, adjustHeight]);

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: string) => {
    if (textareaRef.current) {
      textareaRef.current.value = suggestion;
      setPromptText(suggestion);
      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
      adjustHeight();
    }
    setShowSuggestions(false);
  };

  // Handle file uploads
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        if (!file.type.match("image.*")) {
          alert("Please select a valid image file.");
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Result = e.target?.result as string;
          setUploadedImages((prevImages) => [...prevImages, base64Result]);
        };
        reader.onerror = () => {
          alert("Cannot read this file. Please try again!");
        };
        reader.readAsDataURL(file);
      });
    }

    if (event.target) {
      event.target.value = "";
    }
  };

  // Remove uploaded image
  const removeImage = (indexToRemove: number) => {
    setUploadedImages((prevImages) =>
      prevImages.filter((_, index) => index !== indexToRemove)
    );
  };

  // Effect for updating scroll position when images are added
  useEffect(() => {
    if (imagesContainerRef.current && uploadedImages.length > 0) {
      imagesContainerRef.current.scrollLeft =
        imagesContainerRef.current.scrollWidth;
    }
  }, [uploadedImages]);

  // Effect for handling textarea resizing
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Initial height adjustment
    adjustHeight();

    const handleResize = () => {
      adjustHeight();
    };

    // Listen for window resize to recalculate height
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [adjustHeight]);

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showSuggestions &&
        suggestionsRef.current &&
        suggestionButtonRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !suggestionButtonRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSuggestions]);

  // Check prompt height when current image changes
  useEffect(() => {
    if (currentViewImageIndex !== null) {
      setTimeout(checkPromptHeight, 100);
    }
  }, [currentViewImageIndex]);

  // Handle keyboard navigation for image viewer
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (currentViewImageIndex === null) return;

      switch (event.key) {
        case "Escape":
          closeImageViewer();
          break;
        case "ArrowLeft":
          navigateImage("prev");
          break;
        case "ArrowRight":
          navigateImage("next");
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentViewImageIndex, selectedImages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const updateTextarea = () => {
      adjustHeight();
      setPromptText(textarea.value);
    };

    // Add multiple event listeners for better coverage
    textarea.addEventListener("input", updateTextarea);
    textarea.addEventListener("paste", updateTextarea);
    textarea.addEventListener("cut", updateTextarea);

    // Initial adjustment
    adjustHeight();

    return () => {
      textarea.removeEventListener("input", updateTextarea);
      textarea.removeEventListener("paste", updateTextarea);
      textarea.removeEventListener("cut", updateTextarea);
    };
  }, [adjustHeight]);

  // Clean up interval when component unmounts
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`element-default-screen ${
        showHistorySidebar ? "with-sidebar" : ""
      }`}
    >
      <div className="main-2">
        <div className="overlap-2">
          <div className="aside">
            <div className="img-wrapper">
              <img className="SVG-4" alt="Svg" src="/img/svg-8.svg" />
            </div>

            <div className="overlap-3">
              <div className="link-wrapper">
                <div className="link">
                  <img className="SVG-4" alt="Svg" src="/img/svg-7.svg" />
                </div>
              </div>

              <img
                className="mask-group"
                alt="Mask group"
                src="/img/mask-group.svg"
              />
            </div>
          </div>

          <div
            className={`container-wrapper ${
              showHistorySidebar ? "shifted" : ""
            }`}
          >
            <div className="container-7">
              <div className="horizontal-border-2">
                <div className="heading-images-2">Images</div>

                <div className="flex-10">
                  {selectedImages.length > 0 && (
                    <button className="button-5" onClick={clearAllImages}>
                      <div className="overlap-group-3">
                        <div
                          className={`background-8 flex-5 ${
                            showHistorySidebar ? "active" : ""
                          }`}
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
                          <div className="text-wrapper-6">Clear</div>
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    className="button-5"
                    onClick={toggleHistorySidebar}
                    ref={historyButtonRef}
                  >
                    <div className="overlap-group-3">
                      <div
                        className={`background-5 ${
                          showHistorySidebar ? "active" : ""
                        }`}
                      />
                      <img className="SVG-5" alt="Svg" src="/img/svg-9.svg" />
                      <div className="text-wrapper-6">History</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <div className="image-grid-items" ref={gridContainerRef}>
                  {/* Item loading */}
                  {isLoading && (
                    <div className="image-items image-item-loading">
                      <div className="loading-container">
                        <button
                          className="loading-close-btn"
                          onClick={cancelImageGeneration}
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
                              d="M5.636 5.636a1 1 0 0 1 1.414 0l4.95 4.95 4.95-4.95a1 1 0 0 1 1.414 1.414L13.414 12l4.95 4.95a1 1 0 0 1-1.414 1.414L12 13.414l-4.95 4.95a1 1 0 0 1-1.414-1.414l4.95-4.95-4.95-4.95a1 1 0 0 1 0-1.414Z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </button>
                        <div className="loading-time">{countdown}s</div>
                        <button
                          className="loading-edit-btn"
                          onClick={editPromptFromLoading}
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
                              d="M13.293 4.293a4.536 4.536 0 1 1 6.414 6.414l-1 1-7.547 7.547a3 3 0 0 1-1.628.838l-5.368.894a1 1 0 0 1-1.15-1.15l.894-5.368a3 3 0 0 1 .838-1.628l8.547-8.547ZM13 7.414l-6.84 6.84a1 1 0 0 0-.279.543l-.664 3.986 3.986-.664a1 1 0 0 0 .543-.28L16.586 11 13 7.414Zm5 2.172L14.414 6l.293-.293a2.536 2.536 0 0 1 3.586 3.586L18 9.586Z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </button>
                        <div className="loading-prompt-preview">
                          {currentLoadingPrompt
                            ? getFirst10Words(currentLoadingPrompt)
                            : "Generating..."}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hiển thị tất cả hình ảnh, không giới hạn theo gridItemCount */}
                  {selectedImages.map((img, index) => (
                    <div
                      key={`img-${index}-${img.clickedAt}`}
                      className={`image-items image-item-${index + 1}`}
                      onClick={() => viewImage(index)}
                    >
                      <SafeImage
                        src={img.imageUrl}
                        alt={`Generated image ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                        selectedImages={selectedImages}
                        selectedSessions={selectedSessions}
                      />

                      <div className="image-actions-overlay">
                        <div className="actions-header">
                          <button
                            className="image-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSelectedImage(index);
                            }}
                            title="Remove"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              fill="currentColor"
                              viewBox="0 0 16 16"
                            >
                              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                            </svg>
                          </button>

                          <div className="image-navigation-buttons">
                            {hasMultipleInSession(index) && (
                              <>
                                <button
                                  className="image-nav-btn prev"
                                  onClick={(e) =>
                                    navigateImageThumbnail(index, "prev", e)
                                  }
                                  title="Previous in session"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18px"
                                    height="18px"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z"
                                      clipRule="evenodd"
                                    ></path>
                                  </svg>
                                </button>

                                <button
                                  className="image-nav-btn next"
                                  onClick={(e) =>
                                    navigateImageThumbnail(index, "next", e)
                                  }
                                  title="Next in session"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M8.293 4.293a1 1 0 0 1 1.414 0l7 7a1 1 0 0 1 0 1.414l-7 7a1 1 0 0 1-1.414-1.414L14.586 12 8.293 5.707a1 1 0 0 1 0-1.414Z"
                                      clipRule="evenodd"
                                    ></path>
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="image-actions">
                          <div className="image-actions-left">
                            <button
                              className="image-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const image = selectedImages[index];
                                let promptText = "";

                                if (image.sessionId) {
                                  const session = selectedSessions.find(
                                    (s) => s.sessionId === image.sessionId
                                  );

                                  if (
                                    session &&
                                    image.imageIndex !== undefined
                                  ) {
                                    promptText =
                                      session.list[image.imageIndex].prompt;
                                  } else if (image.prompt) {
                                    promptText = image.prompt;
                                  }
                                } else if (image.prompt) {
                                  promptText = image.prompt;
                                }

                                if (promptText) {
                                  navigator.clipboard
                                    .writeText(promptText)
                                    .then(() => {
                                      const notification =
                                        document.createElement("div");
                                      notification.textContent =
                                        "Prompt copied!";
                                      notification.className =
                                        "copy-notification";
                                      document.body.appendChild(notification);
                                      setTimeout(() => {
                                        document.body.removeChild(notification);
                                      }, 2000);
                                    })
                                    .catch((err) => {
                                      console.error(
                                        "Failed to copy text: ",
                                        err
                                      );
                                    });
                                }
                              }}
                              title="Copy prompt"
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
                                  d="M7 5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-2v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h2V5Zm2 2h5a3 3 0 0 1 3 3v5h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v2ZM5 9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5Z"
                                  clipRule="evenodd"
                                ></path>
                              </svg>
                            </button>
                          </div>
                          <div className="image-actions-right">
                            <button
                              className="image-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadImage(img.imageUrl);
                              }}
                              title="Download"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18px"
                                height="18px"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M7.707 10.293a1 1 0 1 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0-1.414-1.414L13 13.586V4a1 1 0 1 0-2 0v9.586l-3.293-3.293ZM5 19a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5Z"></path>
                              </svg>
                            </button>
                            <button
                              className="image-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                addImageToPrompt(img.imageUrl);
                              }}
                              title="Add to prompt"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18px"
                                height="18px"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z"
                                  clipRule="evenodd"
                                ></path>
                              </svg>
                            </button>
                            <button
                              className="image-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                editPrompt(img.prompt);
                              }}
                              title="Edit prompt"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18px"
                                height="18px"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M13.293 4.293a4.536 4.536 0 1 1 6.414 6.414l-1 1-7.547 7.547a3 3 0 0 1-1.628.838l-5.368.894a1 1 0 0 1-1.15-1.15l.894-5.368a3 3 0 0 1 .838-1.628l8.547-8.547ZM13 7.414l-6.84 6.84a1 1 0 0 0-.279.543l-.664 3.986 3.986-.664a1 1 0 0 0 .543-.28L16.586 11 13 7.414Zm5 2.172L14.414 6l.293-.293a2.536 2.536 0 0 1 3.586 3.586L18 9.586Z"
                                  clipRule="evenodd"
                                ></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Ô trống chỉ hiển thị trong chế độ grid cố định (không mở rộng) */}
                  {!expandedGrid &&
                    Array(
                      Math.max(
                        0,
                        gridItemCount -
                          selectedImages.length -
                          (isLoading ? 1 : 0)
                      )
                    )
                      .fill(0)
                      .map((_, index) => (
                        <div
                          key={`empty-${index}`}
                          className={`image-items image-item-${
                            selectedImages.length +
                            (isLoading ? 1 : 0) +
                            index +
                            1
                          }`}
                        />
                      ))}
                </div>

                <div className="overlap-4">
                  <div className="overlay-border-2">
                    <div
                      ref={imagesContainerRef}
                      className={`image-prompt-container ${
                        uploadedImages.length > 0 ? "has-images" : ""
                      }`}
                    >
                      {uploadedImages.length > 0 && (
                        <div className="images-scrollable-container">
                          {uploadedImages.map((image, index) => (
                            <div key={index} className="image-item-wrapper">
                              <img
                                src={image}
                                alt={`Uploaded ${index + 1}`}
                                className="uploaded-image-thumbnail"
                              />
                              <button
                                className="remove-image-btn"
                                onClick={() => removeImage(index)}
                                aria-label="Remove image"
                              >
                                <span className="remove-icon">×</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="textarea-2">
                      <textarea
                        ref={textareaRef}
                        className="input-prompt"
                        placeholder="Describe what you want to see..."
                        onInput={(e) =>
                          setPromptText((e.target as HTMLTextAreaElement).value)
                        }
                        onKeyPress={handleKeyPress}
                      ></textarea>
                    </div>

                    <div className="flex-10 justify-between prompt-actions">
                      <div className="flex">
                        <div
                          className="button-menu-2"
                          ref={suggestionButtonRef}
                          onClick={toggleSuggestions}
                        >
                          <img
                            className="SVG-6"
                            alt="Svg"
                            src="/img/svg-15.svg"
                          />

                          <div
                            ref={suggestionsRef}
                            className={`suggestions-box ${
                              showSuggestions ? "visible" : ""
                            }`}
                          >
                            {suggestionItems.map((item, index) => (
                              <div
                                key={index}
                                className="suggestion-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSuggestion(item);
                                }}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* NEW: Replace both size and number controls with integrated component */}
                        <ImageSizeSelector
                          numberOfImages={numberOfImages}
                          setNumberOfImages={setNumberOfImages}
                          imageSizes={imageSizes}
                          setImageSizes={setImageSizes}
                        />

                        <div className="button-6" onClick={handleUploadClick}>
                          <img
                            className="SVG-6"
                            alt="Svg"
                            src="/img/svg-11.svg"
                          />
                          <input
                            type="file"
                            style={{ display: "none" }}
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                          />
                        </div>
                      </div>

                      <div
                        className={`button-7 ${
                          promptText.trim() ? "active" : ""
                        }`}
                        onClick={
                          promptText.trim() ? handleFormSubmit : undefined
                        }
                        ref={submitButtonRef}
                      >
                        <img className="SVG-6" alt="Svg" src="/img/svg-4.svg" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overlay-shadow-26" />
            </div>
          </div>

          <div
            ref={historySidebarRef}
            className={`history-sidebar ${showHistorySidebar ? "visible" : ""}`}
          >
            <div className="history-content">
              <HistorySidebar
                isVisible={showHistorySidebar}
                toggleSidebar={toggleHistorySidebar}
                onItemClick={handleHistoryItemClick}
                selectedImages={selectedImages}
                maxGridItems={gridItemCount}
                onSelectAll={(unselectedCount) => {
                  setExpandedGrid(true);
                  setGridItemCount(
                    Math.max(
                      gridItemCount,
                      selectedImages.length + unselectedCount
                    )
                  );
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container-8 main-header">
        <div className="header-left">
          <div className="button-dialog-2">
            <div className="background-6">
              <div className="text-wrapper-10">A</div>
            </div>
            <div className="flex-10">
              <div className="container-9">
                <div className="container-10">
                  <div className="text-wrapper-9">AI IMAGE</div>
                </div>
              </div>

              <img className="SVG-7" alt="Svg" src="/img/svg-13.svg" />
            </div>
          </div>

          <div className="text-wrapper-8">/</div>

          <div className="button-dialog-3">
            <div className="container-11">
              <div className="text-wrapper-11">AI Image Generator</div>
            </div>

            <img className="SVG-8" alt="Svg" src="/img/svg-14.svg" />
          </div>
        </div>

        <div className="header-right">
          <div className="background-wrapper">
            <div className="header-right">
              <div className="link-6">
                <img className="SVG-9" alt="Svg" src="/img/svg-16.svg" />
              </div>

              <div
                className="background-wrapper"
                style={{ position: "relative" }}
              >
                <div
                  className="background-7"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="text-wrapper-16">B</div>
                </div>

                {showUserDropdown && (
                  <div className="user-dropdown-menu">
                    <div className="user-info">
                      <div className="user-name">Bui Tran Tung</div>
                      <div className="user-email">tungbt@misencorp.com</div>

                      <div className="theme-toggles">
                        <button className="theme-btn light-mode active">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12 1a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1ZM1 12a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1Zm19 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1Zm-8 8a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm0-12a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-6 4a6 6 0 1 1 12 0 6 6 0 0 1-12 0Zm-.364-7.778a1 1 0 1 0-1.414 1.414l.707.707A1 1 0 0 0 6.343 4.93l-.707-.707ZM4.222 18.364a1 1 0 1 0 1.414 1.414l.707-.707a1 1 0 1 0-1.414-1.414l-.707.707ZM17.657 4.929a1 1 0 1 0 1.414 1.414l.707-.707a1 1 0 0 0-1.414-1.414l-.707.707Zm1.414 12.728a1 1 0 1 0-1.414 1.414l.707.707a1 1 0 0 0 1.414-1.414l-.707-.707Z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </button>
                        <button className="theme-btn dark-mode">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12.784 2.47a1 1 0 0 1 .047.975A8 8 0 0 0 20 15h.057a1 1 0 0 1 .902 1.445A10 10 0 0 1 12 22C6.477 22 2 17.523 2 12c0-5.499 4.438-9.961 9.928-10a1 1 0 0 1 .856.47ZM10.41 4.158a8 8 0 1 0 7.942 12.707C13.613 16.079 10 11.96 10 7c0-.986.143-1.94.41-2.842Z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </button>
                        <button className="theme-btn system-mode">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1em"
                            height="1em"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5 4a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h3v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2h3a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H5Zm9 14v1h-4v-1h4Zm5-2a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14Z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="dropdown-menu-items">
                      <button className="dropdown-item">Your profile</button>
                      <button className="dropdown-item">
                        Terms & policies
                      </button>
                      <button
                        className="dropdown-item"
                        onClick={async () => {
                          try {
                            await fetch(API_ENDPOINTS.AUTH_LOGOUT, {
                              method: "POST",
                              credentials: "include",
                            });
                          } catch (error) {
                            console.error("Logout failed:", error);
                          }
                        }}
                      >
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {currentViewImageIndex !== null &&
        selectedImages[currentViewImageIndex] && (
          <div className="image-viewer-modal">
            <div className="image-viewer-container">
              <button className="image-viewer-close" onClick={closeImageViewer}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.636 5.636a1 1 0 0 1 1.414 0l4.95 4.95 4.95-4.95a1 1 0 0 1 1.414 1.414L13.414 12l4.95 4.95a1 1 0 0 1-1.414 1.414L12 13.414l-4.95 4.95a1 1 0 0 1-1.414-1.414l4.95-4.95-4.95-4.95a1 1 0 0 1 0-1.414Z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </button>

              <div className="image-viewer-content">
                <div className="image-viewer-left">
                  {currentSessionId &&
                    (() => {
                      const session = selectedSessions.find(
                        (s) => s.sessionId === currentSessionId
                      );
                      if (session && session.list[currentSessionImageIndex]) {
                        return (
                          <img
                            src={
                              session.list[currentSessionImageIndex].imageBase64
                            }
                            alt="Enlarged view"
                            className="image-viewer-img"
                          />
                        );
                      } else {
                        return (
                          <img
                            src={selectedImages[currentViewImageIndex].imageUrl}
                            alt="Enlarged view"
                            className="image-viewer-img"
                          />
                        );
                      }
                    })()}
                </div>

                <div className="image-viewer-right">
                  <div className="image-viewer-details">
                    <div className="session-possition">
                      {currentSessionId &&
                        (() => {
                          const session = selectedSessions.find(
                            (s) => s.sessionId === currentSessionId
                          );
                          if (session) {
                            return `${currentSessionImageIndex + 1}`;
                          } else {
                            return "1";
                          }
                        })()}

                      <div className="flex-10">
                        {currentSessionId &&
                          selectedSessions.find(
                            (s) => s.sessionId === currentSessionId
                          )?.list.length > 1 && (
                            <button
                              className="image-viewer-nav prev"
                              onClick={() => navigateImage("prev")}
                              title="Previous image"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18px"
                                height="18px"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z"
                                  clipRule="evenodd"
                                ></path>
                              </svg>
                            </button>
                          )}

                        {currentSessionId &&
                          (() => {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            return session && session.list.length > 1 ? (
                              <button
                                className="image-viewer-nav next"
                                onClick={() => navigateImage("next")}
                                title="Next image"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18px"
                                  height="18px"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.293 4.293a1 1 0 0 1 1.414 0l7 7a1 1 0 0 1 0 1.414l-7 7a1 1 0 0 1-1.414-1.414L14.586 12 8.293 5.707a1 1 0 0 1 0-1.414Z"
                                    clipRule="evenodd"
                                  ></path>
                                </svg>
                              </button>
                            ) : null;
                          })()}
                      </div>
                    </div>

                    <div className="image-info-dropdowns">
                      <ImageInfoDropdown title="Describe">
                        {(() => {
                          let describeText = "Thông tin mô tả về ảnh này";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.describe) {
                              describeText = session.describe;
                            }
                          }

                          return <p className="prompt-text">{describeText}</p>;
                        })()}
                      </ImageInfoDropdown>

                      <ImageInfoDropdown title="Image Prompt" isOpen={false}>
                        {(() => {
                          let currentImagePrompt = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (
                              session &&
                              session.list[currentSessionImageIndex]
                            ) {
                              // ✅ Lấy prompt cụ thể của image hiện tại
                              currentImagePrompt =
                                session.list[currentSessionImageIndex].prompt;
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.prompt
                          ) {
                            // ✅ Lấy prompt từ selectedImages nếu không có session
                            currentImagePrompt =
                              selectedImages[currentViewImageIndex].prompt;
                          }

                          return (
                            <div
                              className="prompt-text html-content"
                              dangerouslySetInnerHTML={{
                                __html:
                                  currentImagePrompt || "No prompt available",
                              }}
                            />
                          );
                        })()}
                      </ImageInfoDropdown>

                      <ImageInfoDropdown title="Ad Creative A">
                        {(() => {
                          let adCreativeText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (
                              session &&
                              session.list[currentSessionImageIndex] &&
                              session.list[currentSessionImageIndex].AdCreativeA
                            ) {
                              adCreativeText =
                                session.list[currentSessionImageIndex]
                                  .AdCreativeA;
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.AdCreativeA
                          ) {
                            adCreativeText =
                              selectedImages[currentViewImageIndex].AdCreativeA;
                          }

                          return (
                            <div
                              className="prompt-text html-content"
                              dangerouslySetInnerHTML={{
                                __html: adCreativeText,
                              }}
                            />
                          );
                        })()}
                      </ImageInfoDropdown>

                      <ImageInfoDropdown title="Ad Creative B">
                        {(() => {
                          let adCreativeText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (
                              session &&
                              session.list[currentSessionImageIndex] &&
                              session.list[currentSessionImageIndex].AdCreativeB
                            ) {
                              adCreativeText =
                                session.list[currentSessionImageIndex]
                                  .AdCreativeB;
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.AdCreativeB
                          ) {
                            adCreativeText =
                              selectedImages[currentViewImageIndex].AdCreativeB;
                          }

                          return (
                            <div
                              className="prompt-text html-content"
                              dangerouslySetInnerHTML={{
                                __html: adCreativeText,
                              }}
                            />
                          );
                        })()}
                      </ImageInfoDropdown>
                    </div>

                    <div className="image-viewer-actions">
                      <button
                        className="image-viewer-action-btn copy-btn"
                        onClick={() => {
                          let promptText = "";
                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (
                              session &&
                              session.list[currentSessionImageIndex]
                            ) {
                              promptText =
                                session.list[currentSessionImageIndex].prompt;
                            } else if (
                              selectedImages[currentViewImageIndex].prompt
                            ) {
                              promptText =
                                selectedImages[currentViewImageIndex].prompt;
                            }
                          }

                          if (promptText) {
                            navigator.clipboard
                              .writeText(promptText)
                              .then(() => {
                                const notification =
                                  document.createElement("div");
                                notification.textContent = "Prompt copied!";
                                notification.className = "copy-notification";
                                document.body.appendChild(notification);
                                setTimeout(() => {
                                  document.body.removeChild(notification);
                                }, 2000);
                              })
                              .catch((err) => {
                                console.error("Failed to copy text: ", err);
                              });
                          }
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
                        </svg>
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
