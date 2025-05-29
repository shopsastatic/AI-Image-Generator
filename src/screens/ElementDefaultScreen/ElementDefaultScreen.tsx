import React, { useEffect, useRef, useState, useCallback } from "react";
import "./default.css";
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

export const ElementDefaultScreen = (): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  const [imageSizes, setImageSizes] = useState<{
    Square: number;
    Portrait: number;
    Landscape: number;
  }>({
    Square: 0,
    Portrait: 0,
    Landscape: 0,
  });

  const [selectedCategory, setSelectedCategory] = useState<{
    category: string;
    subcategory: string;
  }>({
    category: "google_prompt",
    subcategory: "",
  });
  
  // FIX: Add states for model and HD mode
  const [selectedModel, setSelectedModel] = useState<string>("deepsearch");
  const [isHDMode, setIsHDMode] = useState<boolean>(false);
  
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

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleCategoryChange = (category: string, subcategory: string) => {
    setSelectedCategory({ category, subcategory });
  };

  // FIX: Add handlers for model and HD mode changes
  const handleModelChange = (model: string) => {
    console.log('🔄 Model changed to:', model);
    setSelectedModel(model);
  };

  const handleHDModeChange = (isHD: boolean) => {
    console.log('🔄 HD Mode changed to:', isHD);
    setIsHDMode(isHD);
  };

  const [currentViewImageIndex, setCurrentViewImageIndex] = useState<
    number | null
  >(null);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionImageIndex, setCurrentSessionImageIndex] =
    useState<number>(0);

  const [promptExpanded, setPromptExpanded] = useState<boolean>(false);

  const [gridItemCount, setGridItemCount] = useState<number>(8);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesContainerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionButtonRef = useRef<HTMLImageElement>(null);
  const historySidebarRef = useRef<HTMLDivElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const promptTextRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLDivElement>(null);

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

  const getSizeNameForIndex = (index: number): string => {
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

    const totalAssigned = sizesArray.length;
    const remaining = numberOfImages - totalAssigned;
    for (let i = 0; i < remaining; i++) {
      sizesArray.push("Square");
    }

    return sizesArray[index] || "Square";
  };

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
      } catch (error) {
        console.error("Storage initialization failed:", error);
        setStorageReady(true);
      }
    };

    initStorage();
  }, []);

  const getFirst10Words = (text: string): string => {
    return text.split(" ").slice(0, 10).join(" ") + "...";
  };

  const startJobPolling = useCallback(
    (jobId: string) => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      const pollJob = async () => {
        try {
          const response = await fetch(`/api/image-generation/status/${jobId}`);
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to check job status");
          }

          switch (data.status) {
            case "pending":
              setLoadingStatus("Job queued...");
              break;
            case "processing":
              setLoadingStatus(data.progress.currentStep || "Processing...");
              break;
            case "completed":
              await handleJobCompleted(jobId);
              return;
            case "failed":
              handleJobFailed(data.error || "Job failed");
              return;
            case "cancelled":
              handleJobCancelled();
              return;
          }
        } catch (error) {
          console.error(`Polling error for job ${jobId}:`, error);
          handleJobFailed(error.message);
        }
      };

      pollJob();

      const interval = setInterval(pollJob, 2000);
      setPollingInterval(interval);
    },
    [pollingInterval]
  );

  const stopJobPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  // FIX: Improved handleJobCompleted
  const handleJobCompleted = async (jobId: string) => {
    try {
      console.log('🎯 Job completed, fetching results:', jobId);
      
      const response = await fetch(`/api/image-generation/results/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch job results");
      }

      console.log('📦 Results received:', data);
      await processJobResults(data);
      
    } catch (error) {
      console.error("Failed to fetch job results:", error);
      handleJobFailed(error.message);
    } finally {
      // FIX: Always stop polling and reset state
      stopJobPolling();
      setTimeout(() => {
        resetLoadingState();
      }, 1000);
    }
  };

  const handleJobFailed = (error: string) => {
    setLoadingStatus(`Generation failed: ${error}`);
    showNotification("error", "Generation Failed!", error);

    setTimeout(() => {
      resetLoadingState();
    }, 3000);
  };

  const handleJobCancelled = () => {
    setLoadingStatus("Generation cancelled");
    resetLoadingState();
  };

  const resetLoadingState = () => {
    console.log('🔍 RESET DEBUG - Before reset - currentLoadingPrompt:', currentLoadingPrompt);
    
    setIsLoading(false);
    setLoadingStatus("");
    // FIX: DON'T reset currentLoadingPrompt here - we need it for the session
    // setCurrentLoadingPrompt(""); // ← COMMENTED OUT
    setCurrentJobId(null);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    stopJobPolling();
    
    console.log('🔍 RESET DEBUG - After reset - currentLoadingPrompt should still be:', currentLoadingPrompt);
  };

  // FIX: Complete rewrite of processJobResults
  const processJobResults = async (jobData: any) => {
    try {
      const { results, sessionId, claudeResponse } = jobData; // FIX: Get claudeResponse from jobData

      console.log('🔄 Processing job results for session:', sessionId);
      console.log('📝 Claude response received:', claudeResponse ? 'YES' : 'NO');
      console.log('🔍 PROCESS DEBUG - currentLoadingPrompt:', currentLoadingPrompt);
      console.log('🔍 PROCESS DEBUG - currentLoadingPrompt length:', currentLoadingPrompt.length);
      console.log('🔍 PROCESS DEBUG - currentLoadingPrompt type:', typeof currentLoadingPrompt);

      // Fix: Attach Claude response to each image
      const successfulImages = results
        .filter(
          (img: any) =>
            img.imageBase64 &&
            img.imageBase64.startsWith("data:") &&
            !img.imageBase64.includes(
              "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM"
            )
        )
        .map((img: any) => ({
          ...img,
          claudeResponse: claudeResponse, // Use claudeResponse from server
        }));

      const failedImages = results.filter(
        (img: any) => !successfulImages.some((success: any) => success === img)
      );

      if (successfulImages.length === 0) {
        throw new Error("No images were successfully generated");
      }

      if (failedImages.length > 0 && successfulImages.length > 0) {
        showNotification(
          "warning",
          "Partial Success",
          `${successfulImages.length}/${results.length} images generated successfully.`
        );
      }

      // FIX: Better handling of describe - use fallback if currentLoadingPrompt is empty
      let describeToUse = currentLoadingPrompt;
      if (!describeToUse || describeToUse.trim() === '') {
        // Fallback: try to get from jobData or use a default
        describeToUse = jobData.originalPrompt || jobData.userPrompt || 'Generated images';
        console.log('⚠️ PROCESS DEBUG - currentLoadingPrompt is empty, using fallback:', describeToUse);
      }

      console.log('🔍 PROCESS DEBUG - Final describe to use:', describeToUse);

      // Fix: Ensure describe is ALWAYS the user's original input
      const sessionData = {
        sessionId: sessionId,
        describe: describeToUse, // Use the corrected describe
        images: successfulImages,
      };

      try {
        await storageManager.saveSession(sessionData);
        console.log("✅ Session saved with describe:", describeToUse);
      } catch (storageError) {
        console.error("Storage save failed:", storageError);
        showNotification(
          "error",
          "Storage Full!",
          "Your images were generated but couldn't be saved due to storage limits."
        );
      }

      // Convert images to blob URLs for display
      const convertedImages = await Promise.all(
        successfulImages.map(async (img: any) => {
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
              claudeResponse: img.claudeResponse,
            };
          } catch (error) {
            console.warn("Failed to convert to blob, using base64:", error);
            return {
              ...img,
              isBlob: false,
              claudeResponse: img.claudeResponse,
            };
          }
        })
      );

      // FIX: Only create session ONCE and avoid duplicates
      const existingSessionIndex = selectedSessions.findIndex(
        s => s.sessionId === sessionId
      );

      const newSession = {
        sessionId: sessionId,
        clickedAt: Date.now(),
        currentImageIndex: 0,
        describe: describeToUse, // Use the corrected describe
        list: convertedImages,
      };

      console.log('🔖 Creating session with describe:', newSession.describe);

      if (existingSessionIndex !== -1) {
        // Update existing session
        console.log('🔄 Updating existing session:', sessionId);
        setSelectedSessions((prevSessions) => 
          prevSessions.map((session, index) => 
            index === existingSessionIndex ? newSession : session
          )
        );
      } else {
        // Add new session
        console.log('➕ Adding new session:', sessionId);
        setSelectedSessions((prevSessions) => [newSession, ...prevSessions]);
      }

      // FIX: Update selectedImages without duplicates
      if (convertedImages.length > 0) {
        const firstImageObj = {
          imageUrl: convertedImages[0].imageBase64,
          clickedAt: Date.now(),
          prompt: convertedImages[0].prompt,
          size: convertedImages[0].size,
          quality: convertedImages[0].quality,
          sessionId: sessionId,
          imageIndex: 0,
          claudeResponse: convertedImages[0].claudeResponse,
          AdCreativeA: convertedImages[0].AdCreativeA,
          AdCreativeB: convertedImages[0].AdCreativeB,
          targeting: convertedImages[0].targeting,
          imageName: convertedImages[0].imageName,
        };

        // FIX: Remove existing images from same session first
        setSelectedImages((prevImages) => {
          const filteredImages = prevImages.filter(img => img.sessionId !== sessionId);
          return [firstImageObj, ...filteredImages.slice(0, gridItemCount - 1)];
        });
      }

      window.dispatchEvent(new Event("historyUpdated"));
      console.log('✅ Job results processed successfully');
      
    } catch (error) {
      console.error("Error processing job results:", error);
      throw error;
    }
  };

  const cancelImageGeneration = async () => {
    if (currentJobId) {
      try {
        await fetch(`/api/image-generation/cancel/${currentJobId}`, {
          method: "POST",
        });
        setLoadingStatus("Cancelling...");
      } catch (error) {
        console.error("Error cancelling job:", error);
      }
    }

    resetLoadingState();
  };

  const editPromptFromLoading = () => {
    if (currentLoadingPrompt && textareaRef.current) {
      textareaRef.current.value = currentLoadingPrompt;
      setPromptText(currentLoadingPrompt);

      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
      adjustHeight();
    }
  };

  // FIX: Improved handleFormSubmit with better state management
  const handleFormSubmit = async () => {
    if (!promptText.trim()) return;

    if (!instructionsText) {
      console.error("Instructions have not been loaded yet");
      alert("Please wait for instructions to load");
      return;
    }

    const sessionId = `session-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const currentPromptText = promptText.trim();
    
    // FIX: Debug currentLoadingPrompt
    console.log('🔍 SUBMIT DEBUG - promptText:', promptText);
    console.log('🔍 SUBMIT DEBUG - currentPromptText:', currentPromptText);
    console.log('🔍 SUBMIT DEBUG - Before setCurrentLoadingPrompt');
    
    setCurrentLoadingPrompt(currentPromptText);
    
    console.log('🔍 SUBMIT DEBUG - After setCurrentLoadingPrompt');
    console.log('🔍 SUBMIT DEBUG - currentLoadingPrompt should be:', currentPromptText);

    // Clear input AFTER saving to currentLoadingPrompt
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
    setLoadingStatus("Starting generation...");

    setCountdown(1);

    // FIX: Clear existing countdown before setting new one
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prevCount) => {
        // FIX: Check if component is still mounted
        if (!textareaRef.current) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return prevCount;
        }
        return prevCount + 1;
      });
    }, 1000);

    try {
      const outputCount = numberOfImages;
      const imageSizesString = generateImageSizesString();

      // FIX: Use currentPromptText directly instead of relying on state
      console.log('🔍 SUBMIT DEBUG - Sending to server:', currentPromptText);
      console.log('🔍 SUBMIT DEBUG - Selected model:', selectedModel);
      console.log('🔍 SUBMIT DEBUG - HD Mode:', isHDMode);

      const jobResponse = await fetch("/api/image-generation/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId,
          userPrompt: currentPromptText, // Use the captured prompt text
          numberOfImages: outputCount,
          imageSizesString: imageSizesString,
          selectedQuality: selectedQuality,
          selectedCategory: selectedCategory,
          selectedModel: selectedModel, // FIX: Add model selection
          isHDMode: isHDMode, // FIX: Add HD mode flag
        }),
      });

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json();
        throw new Error(errorData.error || "Failed to submit generation job");
      }

      const jobData = await jobResponse.json();
      const jobId = jobData.jobId;

      setCurrentJobId(jobId);
      setLoadingStatus("Processing...");

      startJobPolling(jobId);
    } catch (error) {
      console.error("Form submission failed:", error);
      setLoadingStatus("Error occurred");
      showNotification("error", "API Error!", error.message);

      setTimeout(() => {
        resetLoadingState();
      }, 3000);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (currentJobId) {
        try {
          await fetch(`/api/image-generation/cancel/${currentJobId}`, {
            method: "POST",
          });
        } catch (error) {
          console.error("Error cancelling job on page unload:", error);
        }
      }
    };

    const handleUnload = async () => {
      if (currentJobId) {
        navigator.sendBeacon(
          `/api/image-generation/cancel/${currentJobId}`,
          JSON.stringify({})
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
      stopJobPolling();
    };
  }, [currentJobId, stopJobPolling]);

  // FIX: Better cleanup on unmount
  useEffect(() => {
    return () => {
      // Only cleanup when component actually unmounts
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, []);

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

    const nextImageData = session.list[nextImageIndexInSession];

    const nextImageObject = {
      imageUrl: nextImageData.imageBase64,
      clickedAt: Date.now(),
      prompt: nextImageData.prompt,
      size: nextImageData.size,
      quality: nextImageData.quality,
      sessionId: currentImage.sessionId,
      imageIndex: nextImageIndexInSession,
    };

    const updatedImages = [...selectedImages];
    updatedImages[index] = nextImageObject;
    setSelectedImages(updatedImages);
  };

  const calculateOptimalGridSize = useCallback(() => {
    if (!gridContainerRef.current) return;

    const container = gridContainerRef.current;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const minItemSize = 200;
    const gap = 16;

    const columnsCount = Math.max(2, Math.floor(containerWidth / minItemSize));

    const maxRowsBasedOnHeight = Math.max(
      2,
      Math.floor(containerHeight / minItemSize)
    );

    const rowsCount = Math.min(
      maxRowsBasedOnHeight,
      Math.ceil(48 / columnsCount)
    );

    const newGridCount = columnsCount * rowsCount;

    setBaseGridCount(newGridCount);

    if (!expandedGrid) {
      setGridItemCount(newGridCount);
    }
  }, [expandedGrid]);

  useEffect(() => {
    calculateOptimalGridSize();

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        calculateOptimalGridSize();
      }, 100);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [calculateOptimalGridSize]);

  useEffect(() => {
    if (!expandedGrid) {
      setGridItemCount(baseGridCount);
    }
  }, [baseGridCount, expandedGrid]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateOptimalGridSize();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedImages.length, calculateOptimalGridSize]);

  useEffect(() => {
    if (gridContainerRef.current) {
      calculateOptimalGridSize();
    }
  }, [selectedImages, calculateOptimalGridSize]);

  const handleHistoryItemClick = (item: any) => {
    // 🔍 Console log toàn bộ data của session khi click
    console.log('🎯 History session clicked:', item.id);
    console.log('📊 Full session data:', item);
    console.log('📝 Session describe:', item.describe);
    console.log('🖼️  Session images count:', item.list ? item.list.length : 0);
    console.log('📋 Session images list:', item.list);
    
    if (item.list && item.list.length > 0) {
      // Console thêm chi tiết từng ảnh
      item.list.forEach((img: any, index: number) => {
        console.log(`🖼️  Image ${index + 1}:`, {
          prompt: img.prompt,
          size: img.size,
          quality: img.quality,
          timestamp: img.timestamp,
          AdCreativeA: img.AdCreativeA,
          AdCreativeB: img.AdCreativeB,
          targeting: img.targeting,
          claudeResponse: img.claudeResponse ? 'Present' : 'Missing',
          imageBase64: img.imageBase64 ? `${img.imageBase64.substring(0, 50)}...` : 'Missing'
        });
      });
      
      const sessionIndex = selectedSessions.findIndex(
        (s) => s.sessionId === item.id
      );

      if (sessionIndex === -1) {
        // FIX: Ensure describe is preserved when loading from history
        const newSession = {
          sessionId: item.id,
          clickedAt: Date.now(),
          currentImageIndex: 0,
          describe: item.describe || 'History session', // Use describe from history
          list: [...item.list],
        };

        console.log('🔖 Loading history session with describe:', newSession.describe);

        setSelectedSessions((prevSessions) => [
          newSession,
          ...prevSessions,
        ]);

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
            claudeResponse: firstImage.claudeResponse,
            AdCreativeA: firstImage.AdCreativeA,
            AdCreativeB: firstImage.AdCreativeB,
            targeting: firstImage.targeting,
            imageName: firstImage.imageName,
          };

          const updatedImages = [newImageObj, ...prevImages];

          if (updatedImages.length > baseGridCount) {
            setExpandedGrid(true);
            setGridItemCount(updatedImages.length);
          }

          return updatedImages;
        });
      }
    } else {
      console.log('⚠️ No images found in this session');
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

  const clearAllImages = () => {
    setSelectedImages([]);
    setSelectedSessions([]);
    setCurrentViewImageIndex(null);
    setCurrentSessionId(null);
  };

  const viewImage = (index: number) => {
    const selectedImage = selectedImages[index];
    console.log('🔍 viewImage called with index:', index);
    console.log('🔍 selectedImage:', selectedImage);
    
    setCurrentViewImageIndex(index);
    setPromptExpanded(false);

    if (selectedImage && selectedImage.sessionId) {
      console.log('🔍 Setting currentSessionId to:', selectedImage.sessionId);
      setCurrentSessionId(selectedImage.sessionId);

      const session = selectedSessions.find(
        (s) => s.sessionId === selectedImage.sessionId
      );
      
      console.log('🔍 Found session:', session ? 'YES' : 'NO');
      if (session) {
        console.log('🔍 Session data:', {
          sessionId: session.sessionId,
          describe: session.describe,
          imageCount: session.list.length
        });
        
        if (selectedImage.imageIndex !== undefined) {
          console.log('🔍 Using predefined imageIndex:', selectedImage.imageIndex);
          setCurrentSessionImageIndex(selectedImage.imageIndex);
        } else {
          const imageIndex = session.list.findIndex(
            (img) => img.imageBase64 === selectedImage.imageUrl
          );
          console.log('🔍 Found imageIndex:', imageIndex);
          if (imageIndex !== -1) {
            setCurrentSessionImageIndex(imageIndex);
          }
        }
      }
    } else {
      console.log('⚠️ No sessionId found in selectedImage');
      setCurrentSessionId(null);
    }

    setTimeout(checkPromptHeight, 100);
  };

  const closeImageViewer = () => {
    setCurrentViewImageIndex(null);
    setCurrentSessionId(null);
    setPromptExpanded(false);
  };

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

  const togglePromptExpand = () => {
    setPromptExpanded(!promptExpanded);
  };

  const addImageToPrompt = (imageUrl: string) => {
    setUploadedImages((prev) => [...prev, imageUrl]);
  };

  const editPrompt = (prompt: string = "") => {
    if (textareaRef.current && prompt) {
      textareaRef.current.value = prompt;
      setPromptText(prompt);
      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
      adjustHeight();
    }
  };

  const downloadImage = async (
    imageUrl: string,
    claudeResponse?: string,
    imageIndex?: number,
    imageName?: string // Thêm param imageName trực tiếp
  ) => {
    try {
      let fileName = "";

      // Fix: Ưu tiên imageName từ Claude response trước
      if (imageName && imageName.trim()) {
        fileName = cleanFileName(imageName);
        console.log("🏷️ Using imageName from Claude:", fileName);
      } else if (claudeResponse) {
        fileName = extractImageNameFromClaudeResponse(
          claudeResponse,
          imageIndex || 0
        );
        console.log("📝 Extracted from Claude response:", fileName);
      } else {
        fileName = `ai-image-${Date.now()}`;
        console.log("🔄 Using fallback name:", fileName);
      }

      // Đảm bảo có extension
      if (!fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        fileName = `${fileName}.png`;
      }

      if (imageUrl.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = fileName;
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
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);

      console.log("✅ Downloaded:", fileName);
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

    textarea.style.height = "auto";
    textarea.style.overflowY = "hidden";

    requestAnimationFrame(() => {
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 126;
      const minHeight = 40;

      if (!textarea.value.trim()) {
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const isOverflowing = textarea.scrollHeight > minHeight;

      if (!isOverflowing) {
        textarea.style.height = `${minHeight}px`;
        textarea.style.overflowY = "hidden";
      } else {
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
        textareaRef.current.style.height = "40px";
        textareaRef.current.style.overflowY = "hidden";
      } else {
        adjustHeight();
      }
    }
  }, [promptText, adjustHeight]);

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

  const removeImage = (indexToRemove: number) => {
    setUploadedImages((prevImages) =>
      prevImages.filter((_, index) => index !== indexToRemove)
    );
  };

  useEffect(() => {
    if (imagesContainerRef.current && uploadedImages.length > 0) {
      imagesContainerRef.current.scrollLeft =
        imagesContainerRef.current.scrollWidth;
    }
  }, [uploadedImages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    adjustHeight();

    const handleResize = () => {
      adjustHeight();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [adjustHeight]);

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

  // Debug useEffect to track currentLoadingPrompt changes
  useEffect(() => {
    console.log('🔍 LOADING PROMPT CHANGE:', currentLoadingPrompt);
    console.log('🔍 LOADING PROMPT LENGTH:', currentLoadingPrompt.length);
  }, [currentLoadingPrompt]);

  // Debug useEffect to track state changes
  useEffect(() => {
    console.log('🔍 DEBUG State Change - currentSessionId:', currentSessionId);
    console.log('🔍 DEBUG State Change - currentViewImageIndex:', currentViewImageIndex);
    console.log('🔍 DEBUG State Change - selectedSessions count:', selectedSessions.length);
    
    if (currentSessionId) {
      const session = selectedSessions.find(s => s.sessionId === currentSessionId);
      console.log('🔍 DEBUG State Change - Current session found:', session ? 'YES' : 'NO');
      if (session) {
        console.log('🔍 DEBUG State Change - Current session describe:', session.describe);
      }
    }
  }, [currentSessionId, currentViewImageIndex, selectedSessions]);

  useEffect(() => {
    if (currentViewImageIndex !== null) {
      setTimeout(checkPromptHeight, 100);
    }
  }, [currentViewImageIndex]);

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

    textarea.addEventListener("input", updateTextarea);
    textarea.addEventListener("paste", updateTextarea);
    textarea.addEventListener("cut", updateTextarea);

    adjustHeight();

    return () => {
      textarea.removeEventListener("input", updateTextarea);
      textarea.removeEventListener("paste", updateTextarea);
      textarea.removeEventListener("cut", updateTextarea);
    };
  }, [adjustHeight]);

  const extractImageNameFromClaudeResponse = (
    claudeResponse: string,
    imageIndex: number = 0
  ): string => {
    if (!claudeResponse) {
      return `ai-image-${imageIndex + 1}-${Date.now()}`;
    }

    try {
      const jsonMatch =
        claudeResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
        claudeResponse.match(/\[\s*{\s*".*?":/);

      if (jsonMatch) {
        let jsonText = jsonMatch[1] || claudeResponse;
        jsonText = jsonText
          .replace(/^[\s\S]*?\[/, "[")
          .replace(/\][\s\S]*$/, "]");

        const jsonData = JSON.parse(jsonText);

        if (
          Array.isArray(jsonData) &&
          jsonData[imageIndex] &&
          jsonData[imageIndex].imageName
        ) {
          const imageName = jsonData[imageIndex].imageName;
          return cleanFileName(imageName);
        }
      }

      const imageNamePatterns = [
        /Image Name[:\-]?\s*["']?([^"'\n\r,]+)["']?/gi,
        /"imageName"[\s]*:[\s]*["']([^"']+)["']/gi,
        new RegExp(
          `(?:Image|Prompt)\\s*${
            imageIndex + 1
          }[\\s\\S]*?(?:Image Name|Name)[:\\-]?\\s*["']?([^"'\\n\\r,]+)["']?`,
          "i"
        ),
      ];

      for (const pattern of imageNamePatterns) {
        pattern.lastIndex = 0;
        const matches = Array.from(claudeResponse.matchAll(pattern));

        if (
          matches.length > imageIndex &&
          matches[imageIndex] &&
          matches[imageIndex][1]
        ) {
          const imageName = matches[imageIndex][1].trim();
          if (imageName && imageName.length > 0) {
            return cleanFileName(imageName);
          }
        }
      }

      const promptPatterns = [
        /Create an image[^:]*:\s*([^.\n]{20,80})/i,
        /Visual Composition[^:]*:\s*([^.\n]{20,80})/i,
        /prompt[^:]*:\s*["']?([^"'\n]{20,80})["']?/i,
      ];

      for (const pattern of promptPatterns) {
        const match = claudeResponse.match(pattern);
        if (match && match[1]) {
          const promptText = match[1].trim();
          const words = promptText
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .split(/\s+/)
            .filter((word) => word.length > 3)
            .slice(0, 4)
            .join("-");

          if (words) {
            const generatedName = `${words}-${imageIndex + 1}`;
            return cleanFileName(generatedName);
          }
        }
      }
    } catch (error) {
      console.error("Error extracting image name:", error);
    }

    const fallbackName = `ai-image-${imageIndex + 1}-${Date.now()}`;
    return fallbackName;
  };

  const cleanFileName = (fileName: string): string => {
    // First, clean the basic characters
    let cleaned = fileName
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[-]{2,}/g, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "");

    // FIX: Increase limit and cut by words instead of hard cut
    const maxLength = 120; // Increased from 50 to 120

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Cut by words to avoid cutting in the middle of a word
    const words = cleaned.split('-');
    let result = '';
    
    for (let i = 0; i < words.length; i++) {
      const wordToAdd = i === 0 ? words[i] : '-' + words[i];
      
      if ((result + wordToAdd).length <= maxLength) {
        result += wordToAdd;
      } else {
        break;
      }
    }

    // If result is still empty or too short, use hard cut as fallback
    if (result.length < 10) {
      result = cleaned.substring(0, maxLength);
    }

    // Clean up any trailing dashes
    return result.replace(/^-+|-+$/g, "");
  };

  const showNotification = (type: string, title: string, message: string) => {
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

    useEffect(() => {
      setImageSrc(src);
      setHasError(false);
      setIsLoading(false);
      setRetryCount(0);
    }, [src]);

    const handleImageError = async () => {
      if (hasError || retryCount >= 2) {
        setImageSrc(
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
        );
        setIsLoading(false);
        setHasError(true);
        return;
      }

      setIsLoading(true);
      setHasError(true);
      setRetryCount((prev) => prev + 1);

      try {
        const response = await fetch("/api/proxy-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl: imageSrc }),
        });

        const data = await response.json();

        if (response.ok && data.success && data.base64) {
          setImageSrc(data.base64);
          setHasError(false);
        } else {
          throw new Error(data.error || "Conversion failed");
        }
      } catch (error) {
        console.error("SafeImage: Failed to convert image:", error);

        if (!imageSrc.includes("/api/proxy-image-direct")) {
          try {
            const encodedUrl = encodeURIComponent(imageSrc);
            const proxyUrl = `/api/proxy-image-direct?url=${encodedUrl}`;

            setImageSrc(proxyUrl);
            setHasError(false);
          } catch (proxyError) {
            console.error("SafeImage: Direct proxy also failed:", proxyError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    const handleImageLoad = () => {
      setIsLoading(false);
      setHasError(false);
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

                <div className="flex gap-10">
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

                                const image = selectedImages[index];
                                let claudeResponse = "";
                                let imageIndex = 0;
                                let imageName = "";

                                console.log("📂 Image object:", image); // Debug log

                                if (image.sessionId) {
                                  const session = selectedSessions.find(
                                    (s) => s.sessionId === image.sessionId
                                  );

                                  if (session) {
                                    if (image.imageIndex !== undefined) {
                                      imageIndex = image.imageIndex;
                                      const imageData =
                                        session.list[imageIndex];
                                      imageName = imageData?.imageName || "";
                                      claudeResponse =
                                        imageData?.claudeResponse || "";
                                    } else {
                                      const foundIndex = session.list.findIndex(
                                        (img) =>
                                          img.imageBase64 === image.imageUrl ||
                                          img.prompt === image.prompt
                                      );
                                      if (foundIndex !== -1) {
                                        imageIndex = foundIndex;
                                        const imageData =
                                          session.list[foundIndex];
                                        imageName = imageData?.imageName || "";
                                        claudeResponse =
                                          imageData?.claudeResponse || "";
                                      }
                                    }
                                  }
                                } else {
                                  // Fix: Lấy trực tiếp từ image object
                                  imageName = image.imageName || "";
                                  claudeResponse = image.claudeResponse || "";
                                }

                                console.log("📂 Download params:", {
                                  imageName,
                                  claudeResponse: claudeResponse?.substring(
                                    0,
                                    100
                                  ),
                                  imageIndex,
                                });

                                downloadImage(
                                  image.imageUrl,
                                  claudeResponse,
                                  imageIndex,
                                  imageName
                                );
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

                    <div className="flex gap-10 justify-between prompt-actions">
                      <div className="flex">
                        <div
                          className="button-menu-2 !hidden"
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

                        <ImageSizeSelector
                          numberOfImages={numberOfImages}
                          setNumberOfImages={setNumberOfImages}
                          imageSizes={imageSizes}
                          setImageSizes={setImageSizes}
                          onCategoryChange={handleCategoryChange}
                          onModelChange={handleModelChange}
                          onHDModeChange={handleHDModeChange}
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
            <div className="flex gap-10">
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
                      <div className="user-name">MISEN</div>
                      <div className="user-email">ai@miseninc.com</div>

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
                            await fetch("/api/auth/logout", {
                              method: "POST",
                              credentials: "include",
                            });
                            window.location.reload();
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
                            return `${currentSessionImageIndex + 1}.`;
                          } else {
                            return "1.";
                          }
                        })()}

                      <div className="flex gap-2">
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
                      <ImageInfoDropdown
                        title="Describe"
                        copyContent={(() => {
                          // FIX: Enhanced debug and logic to get describe
                          console.log('🔍 DEBUG Describe - Getting copyContent');
                          console.log('🔍 currentSessionId:', currentSessionId);
                          console.log('🔍 currentViewImageIndex:', currentViewImageIndex);
                          console.log('🔍 selectedSessions length:', selectedSessions.length);
                          console.log('🔍 selectedImages length:', selectedImages.length);

                          let describeText = "No description available";

                          // Method 1: Get from currentSessionId
                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            console.log('🔍 Found session by currentSessionId:', session ? 'YES' : 'NO');
                            if (session) {
                              console.log('🔍 Session describe value:', session.describe);
                              if (session.describe) {
                                describeText = session.describe;
                                console.log('✅ Found describe from currentSessionId:', describeText);
                              }
                            }
                          }

                          // Method 2: Get from current image's session
                          if (describeText === "No description available" && currentViewImageIndex !== null) {
                            const currentImage = selectedImages[currentViewImageIndex];
                            console.log('🔍 Current image:', currentImage ? 'EXISTS' : 'NULL');
                            if (currentImage) {
                              console.log('🔍 Current image sessionId:', currentImage.sessionId);
                              if (currentImage.sessionId) {
                                const session = selectedSessions.find(
                                  (s) => s.sessionId === currentImage.sessionId
                                );
                                console.log('🔍 Found session by image sessionId:', session ? 'YES' : 'NO');
                                if (session) {
                                  console.log('🔍 Session describe value:', session.describe);
                                  if (session.describe) {
                                    describeText = session.describe;
                                    console.log('✅ Found describe from currentImage session:', describeText);
                                  }
                                }
                              }
                            }
                          }

                          // Method 3: Brute force - check all sessions
                          if (describeText === "No description available") {
                            console.log('🔍 Brute force checking all sessions...');
                            selectedSessions.forEach((session, index) => {
                              console.log(`🔍 Session ${index}:`, {
                                sessionId: session.sessionId,
                                describe: session.describe,
                                hasDescribe: !!session.describe
                              });
                            });

                            // Try to get from any session that has describe
                            const sessionWithDescribe = selectedSessions.find(s => s.describe);
                            if (sessionWithDescribe) {
                              describeText = sessionWithDescribe.describe;
                              console.log('✅ Found describe from any session:', describeText);
                            }
                          }

                          console.log('🔖 Final describe for copy:', describeText);
                          return describeText;
                        })()}
                      >
                        {(() => {
                          // FIX: Enhanced debug and logic to get describe for display
                          console.log('🔍 DEBUG Describe - Getting display content');
                          
                          let describeText = "No description available";

                          // Method 1: Get from currentSessionId
                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.describe) {
                              describeText = session.describe;
                              console.log('✅ Display describe from currentSessionId:', describeText);
                            }
                          }

                          // Method 2: Get from current image's session
                          if (describeText === "No description available" && currentViewImageIndex !== null) {
                            const currentImage = selectedImages[currentViewImageIndex];
                            if (currentImage && currentImage.sessionId) {
                              const session = selectedSessions.find(
                                (s) => s.sessionId === currentImage.sessionId
                              );
                              if (session && session.describe) {
                                describeText = session.describe;
                                console.log('✅ Display describe from currentImage session:', describeText);
                              }
                            }
                          }

                          // Method 3: Brute force - get from any session that has describe
                          if (describeText === "No description available") {
                            const sessionWithDescribe = selectedSessions.find(s => s.describe);
                            if (sessionWithDescribe) {
                              describeText = sessionWithDescribe.describe;
                              console.log('✅ Display describe from any session:', describeText);
                            }
                          }

                          console.log('🔖 Final describe for display:', describeText);
                          return <p className="prompt-text">{describeText}</p>;
                        })()}
                      </ImageInfoDropdown>

                      <ImageInfoDropdown
                        title="Image Prompt"
                        isOpen={false}
                        copyContent={(() => {
                          let currentImagePrompt = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (
                              session &&
                              session.list[currentSessionImageIndex]
                            ) {
                              currentImagePrompt =
                                session.list[currentSessionImageIndex].prompt;
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.prompt
                          ) {
                            currentImagePrompt =
                              selectedImages[currentViewImageIndex].prompt;
                          }

                          return currentImagePrompt || "No prompt available";
                        })()}
                      >
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
                              currentImagePrompt =
                                session.list[currentSessionImageIndex].prompt;
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.prompt
                          ) {
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

                      <ImageInfoDropdown
                        title="Ad Creative A"
                        copyContent={(() => {
                          let adCreativeText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.list.length > 0) {
                              // FIX: For Google, always use first object's AdCreativeA
                              // For Facebook, use current image's AdCreativeA
                              const targetImage = selectedCategory.category === 'google_prompt' 
                                ? session.list[0] // Always first object for Google
                                : session.list[currentSessionImageIndex]; // Current image for Facebook
                              
                              if (targetImage && targetImage.AdCreativeA) {
                                adCreativeText = targetImage.AdCreativeA;
                              }
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.AdCreativeA
                          ) {
                            adCreativeText =
                              selectedImages[currentViewImageIndex].AdCreativeA;
                          }

                          return adCreativeText || "No Ad Creative A available";
                        })()}
                      >
                        {(() => {
                          let adCreativeText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.list.length > 0) {
                              // FIX: For Google, always use first object's AdCreativeA
                              // For Facebook, use current image's AdCreativeA
                              const targetImage = selectedCategory.category === 'google_prompt' 
                                ? session.list[0] // Always first object for Google
                                : session.list[currentSessionImageIndex]; // Current image for Facebook
                              
                              if (targetImage && targetImage.AdCreativeA) {
                                adCreativeText = targetImage.AdCreativeA;
                              }
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
                                __html:
                                  adCreativeText ||
                                  "No Ad Creative A available",
                              }}
                            />
                          );
                        })()}
                      </ImageInfoDropdown>

                      <ImageInfoDropdown
                        title="Ad Creative B"
                        copyContent={(() => {
                          let adCreativeText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.list.length > 0) {
                              // FIX: For Google, always use first object's AdCreativeB
                              // For Facebook, use current image's AdCreativeB
                              const targetImage = selectedCategory.category === 'google_prompt' 
                                ? session.list[0] // Always first object for Google
                                : session.list[currentSessionImageIndex]; // Current image for Facebook
                              
                              if (targetImage && targetImage.AdCreativeB) {
                                adCreativeText = targetImage.AdCreativeB;
                              }
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.AdCreativeB
                          ) {
                            adCreativeText =
                              selectedImages[currentViewImageIndex].AdCreativeB;
                          }

                          return adCreativeText || "No Ad Creative B available";
                        })()}
                      >
                        {(() => {
                          let adCreativeText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.list.length > 0) {
                              // FIX: For Google, always use first object's AdCreativeB
                              // For Facebook, use current image's AdCreativeB
                              const targetImage = selectedCategory.category === 'google_prompt' 
                                ? session.list[0] // Always first object for Google
                                : session.list[currentSessionImageIndex]; // Current image for Facebook
                              
                              if (targetImage && targetImage.AdCreativeB) {
                                adCreativeText = targetImage.AdCreativeB;
                              }
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
                                __html:
                                  adCreativeText ||
                                  "No Ad Creative B available",
                              }}
                            />
                          );
                        })()}
                      </ImageInfoDropdown>

                      <ImageInfoDropdown
                        title="Targeting"
                        copyContent={(() => {
                          let targetingText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.list.length > 0) {
                              // FIX: Always use first object's targeting for both Google and Facebook
                              const firstImage = session.list[0];
                              if (firstImage && firstImage.targeting) {
                                targetingText = firstImage.targeting;
                              }
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.targeting
                          ) {
                            targetingText =
                              selectedImages[currentViewImageIndex].targeting;
                          }

                          return targetingText || "No Targeting available";
                        })()}
                      >
                        {(() => {
                          let targetingText = "";

                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.list.length > 0) {
                              // FIX: Always use first object's targeting for both Google and Facebook
                              const firstImage = session.list[0];
                              if (firstImage && firstImage.targeting) {
                                targetingText = firstImage.targeting;
                              }
                            }
                          } else if (
                            selectedImages[currentViewImageIndex]?.targeting
                          ) {
                            targetingText =
                              selectedImages[currentViewImageIndex].targeting;
                          }

                          return (
                            <div
                              className="prompt-text html-content"
                              dangerouslySetInnerHTML={{
                                __html:
                                  targetingText || "No Targeting available",
                              }}
                            />
                          );
                        })()}
                      </ImageInfoDropdown>
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