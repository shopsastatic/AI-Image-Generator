import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./default.css";
import "./style.css";
import HistorySidebar from "./HistorySideBar";
import ImageInfoDropdown from "./ImageInfoDropdown";
import ImageSizeSelector from "./ImageSizeSelector";
import { historyService } from "./historyService";
import RegisterModal from "./RegisterModal";



interface LoadingSession {
  sessionId: string;
  prompt: string;
  category: string;
  subCategory: string;
  platform?: string;
  startTime: number;
  jobId: string | null;
  countdown: number;
}

export const ElementDefaultScreen = (): JSX.Element => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    role: string;
  } | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const navigate = useNavigate();

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
  const [selectedApis, setSelectedApis] = useState<string[]>(["nano", "seed"]);
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<string>("Square HD");

  const [instructionsContent, setInstructionsContent] = useState("");

  const [numberOfImages, setNumberOfImages] = useState<number>(5);
  const [selectedQuality, setSelectedQuality] = useState<string>("Low");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [promptText, setPromptText] = useState<string>("");
  const [currentLoadingPrompt, setCurrentLoadingPrompt] = useState<string>("");
  const [expandedGrid, setExpandedGrid] = useState<boolean>(false);
  const [baseGridCount, setBaseGridCount] = useState<number>(8);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [hasInstructionsSubcategory, setHasInstructionsSubcategory] =
    useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  const [loadingSessions, setLoadingSessions] = useState<LoadingSession[]>([]);

  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);

  const [instructionsSubcategory, setInstructionsSubcategory] =
    useState<string>(""); // ✅ THÊM DÒNG NÀY
  const [instructionsApiData, setInstructionsApiData] = useState<{
    user_prompt: string | null;
    system_prompt: string | null;
  }>({
    user_prompt: null,
    system_prompt: null,
  });
  const [showRegisterModal, setShowRegisterModal] = useState(false);


  const [selectedSessions, setSelectedSessions] = useState<
    Array<{
      sessionId: string;
      clickedAt: number;
      currentImageIndex: number;
      describe?: string;
      category?: string; // ✅ THÊM
      subCategory?: string;
      platform?: string;
      list: Array<{
        imageUrl: string;
        prompt: string;
        category?: string; // ✅ THÊM
        subCategory?: string;
        platform?: string;
        claudeResponse?: string;
        timestamp: string;
        size: string;
        quality: string;
        AdCreativeA?: string;
        AdCreativeB?: string;
      }>;
    }>
  >([]);

  // ✅ CODE MỚI
  const [selectedImages, setSelectedImages] = useState<
    Array<{
      imageUrl: string;
      clickedAt: number;
      prompt?: string;
      category?: string;
      subCategory?: string;
      platform?: string;
      claudeResponse?: string;
      size?: string;
      quality?: string;
      sessionId?: string;
      imageIndex?: number;
    }>
  >([]);

  const handleCategoryChange = (category: string, subcategory: string) => {
    console.log("📝 handleCategoryChange called:", { category, subcategory });

    setSelectedCategory({ category, subcategory });

    setSelectedCategory({ category, subcategory });

    // ✅ CHỈ UPDATE instructionsSubcategory khi category === "instructions"
    if (category === "instructions") {
      console.log("✅ Updating instructions subcategory:", subcategory);
      setHasInstructionsSubcategory(!!subcategory);
      setInstructionsSubcategory(subcategory);
    }
  };

const handleEnhanceImage = async () => {
  if (isEnhancing || currentViewImageIndex === null) return;

  setIsEnhancing(true);

  try {
    const currentImage = selectedImages[currentViewImageIndex];
    let imageUrl = currentImage?.imageUrl || "";
    let sessionId = currentSessionId || currentImage?.sessionId || "";
    let imageIndex = 0;

    if (currentSessionId) {
      const session = selectedSessions.find(
        (s) => s.sessionId === currentSessionId
      );
      if (session && session.list[currentSessionImageIndex]) {
        imageUrl = session.list[currentSessionImageIndex].imageUrl;
        imageIndex = currentSessionImageIndex;
      }
    } else if (currentImage?.imageIndex !== undefined) {
      imageIndex = currentImage.imageIndex;
    }

    if (!imageUrl) {
      throw new Error("No image URL found");
    }

    console.log("📤 Sending enhance request:", { 
      imageUrl, 
      sessionId, 
      imageIndex 
    });

    const response = await fetch("https://n8n.misencorp.com/webhook/enhance-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: imageUrl,
        sessionId: sessionId,
        imageIndex: imageIndex,
      }),
    });

    if (!response.ok) {
      throw new Error(`Enhance failed: ${response.status}`);
    }

    const responseData = await response.json();
    console.log("✅ Enhance response:", responseData);

    // ✅ Parse response - n8n trả về array
    if (!responseData || !Array.isArray(responseData) || responseData.length === 0) {
      throw new Error("Invalid response format");
    }

    const updatedSession = responseData[0];
    
    // Validate structure
    if (!updatedSession.data || !updatedSession.data.url || !Array.isArray(updatedSession.data.url)) {
      throw new Error("Invalid data structure in response");
    }

    // Lấy URL mới tại vị trí imageIndex
    const enhancedUrl = updatedSession.data.url[imageIndex];
    console.log("🎨 Enhanced URL at index", imageIndex, ":", enhancedUrl);

    downloadImage(enhancedUrl)

    // ✅ Update selectedSessions - thay ảnh cũ bằng ảnh mới
    setSelectedSessions((prevSessions) => 
      prevSessions.map((session) => {
        if (session.sessionId === sessionId) {
          const updatedList = [...session.list];
          if (updatedList[imageIndex]) {
            updatedList[imageIndex] = {
              ...updatedList[imageIndex],
              imageUrl: enhancedUrl, // ✅ Thay URL mới
            };
          }
          return {
            ...session,
            list: updatedList,
          };
        }
        return session;
      })
    );

    // ✅ Update selectedImages - nếu ảnh đang được view thì cũng update
    setSelectedImages((prevImages) =>
      prevImages.map((img) => {
        if (
          img.sessionId === sessionId && 
          img.imageIndex === imageIndex
        ) {
          return {
            ...img,
            imageUrl: enhancedUrl, // ✅ Thay URL mới
          };
        }
        return img;
      })
    );

    showNotification(
      "success",
      "Image Enhanced!",
      "Your image has been enhanced successfully."
    );
  } catch (error) {
    console.error("❌ Enhance error:", error);
    showNotification(
      "error",
      "Enhancement Failed!",
      error.message || "Failed to enhance image. Please try again."
    );
  } finally {
    setIsEnhancing(false);
  }
};

  const handleNavigateToProjectManagement = () => {
    navigate("/project-management");
  };

  const sortImagesByPromptGroups = <T extends { prompt?: string }>(
    images: T[]
  ): T[] => {
    if (!images || images.length === 0) return images;

    // Tạo map để group theo prompt
    const groupedByPrompt = new Map<string, T[]>();

    images.forEach((img) => {
      const prompt = img.prompt || "";
      if (!groupedByPrompt.has(prompt)) {
        groupedByPrompt.set(prompt, []);
      }
      groupedByPrompt.get(prompt)!.push(img);
    });

    // Convert map thành array và sort theo size của group (giảm dần)
    const sortedGroups = Array.from(groupedByPrompt.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );

    // Flatten lại thành array phẳng
    const result: T[] = [];
    sortedGroups.forEach(([_, group]) => {
      result.push(...group);
    });

    return result;
  };

  // FIX: Add handlers for model and HD mode changes
  const handleApiChange = useCallback((apis: string[]) => {
    setSelectedApis(apis);
  }, []);

  const handleAspectRatioChange = useCallback((aspectRatio: string) => {
    setSelectedAspectRatio(aspectRatio);
  }, []);

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

  const sessionCountdownRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const pollingIntervalRefs = useRef<Record<string, NodeJS.Timeout>>({});

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

  const parseContent = (rawContent: string) => {
    if (!rawContent) return { promptContent: "", instructions: "" };

    if (rawContent.includes("--- PROMPT CONTENT ---")) {
      const parts = rawContent.split("--- INSTRUCTIONS ---");
      return {
        promptContent: parts[0].replace("--- PROMPT CONTENT ---", "").trim(),
        instructions: parts[1] ? parts[1].trim() : "",
      };
    }
    console.log("Failed to parse content:", rawContent);
    
    return {
      promptContent: "",
      instructions: rawContent,
    };
  };

  // Format JSON prompt for better readability
  const formatPrompt = (prompt) => {
    if (!prompt) return "No prompt available";
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(prompt);
      // If successful, format with indentation
      return `<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: 'Inter'; font-size: 15px; line-height: 1.5; background: #f7f7f7; padding: 12px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(parsed, null, 2)}</pre>`;
    } catch (e) {
      // Not JSON, return as-is
      return prompt;
    }
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
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/auth/verify");
        const data = await response.json();
        if (data.success) {
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      }
    };

    fetchUserInfo();
  }, []);

  // ✅ Auto-load PROMPT CONTENT into textarea
  useEffect(() => {
    const loadInstructions = async () => {
      // ✅ Chỉ thêm dòng này để log
      console.log("🔄 Loading instructions for:", selectedCategory);

      if (!selectedCategory.category) return;

      try {
        const response = await fetch("/api/instructions/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: selectedCategory.category, // ✅ Đã nhận "instructions" từ onChange
            subcategory: selectedCategory.subcategory || "",
            selectedModel: selectedApis[0] || "claude-sonnet",
          }),
        });

        if (!response.ok) {
          console.error("Failed to load instructions");
          return;
        }

        const data = await response.json();

        // ✅ Parse system_prompt or user_prompt
        let parsedContent = { promptContent: "", instructions: "" };

        if (data.system_prompt) {
          parsedContent = parseContent(data.system_prompt);
        } else if (data.user_prompt) {
          parsedContent = parseContent(data.user_prompt);
        }


        // ✅ FIX: Lấy PROMPT CONTENT thay vì instructions
        if (parsedContent.promptContent && parsedContent.promptContent.trim()) {
          if (textareaRef.current) {
            textareaRef.current.value = parsedContent.promptContent;
            setPromptText(parsedContent.promptContent);
            adjustHeight();
          }
        } else {
          console.log("⚠️ No prompt content found - textarea remains empty");
        }
      } catch (error) {
        console.error("Error loading instructions:", error);
      }
    };

    loadInstructions();
  }, [selectedCategory, selectedApis]);

  // ✅ useEffect riêng cho Instructions
  useEffect(() => {
    const loadInstructionsContent = async () => {
      console.log(
        "🔍 useEffect triggered - instructionsSubcategory:",
        instructionsSubcategory
      );

      if (!instructionsSubcategory) {
        console.log("⚠️ No instructionsSubcategory, clearing data");
        setInstructionsApiData({ user_prompt: null, system_prompt: null });
        return;
      }

      console.log(
        "📥 Loading instructions content for:",
        instructionsSubcategory
      );

      try {
        const response = await fetch("/api/instructions/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "instructions",
            subcategory: instructionsSubcategory,
            selectedModel: selectedApis[0] || "claude-sonnet",
          }),
        });

        if (!response.ok) {
          console.error("❌ Failed to load instructions content");
          return;
        }

        const data = await response.json();
        console.log("✅ Instructions API Response:", data);

        setInstructionsApiData({
          user_prompt: data.user_prompt || null,
          system_prompt: data.system_prompt || null,
        });

        console.log("✅ instructionsApiData updated");
      } catch (error) {
        console.error("❌ Error loading instructions content:", error);
        setInstructionsApiData({ user_prompt: null, system_prompt: null });
      }
    };

    loadInstructionsContent();
  }, [instructionsSubcategory, selectedApis]);
  const getFirst10Words = (text: string): string => {
    return text.split(" ").slice(0, 10).join(" ") + "...";
  };

  const startJobPolling = useCallback((jobId: string, sessionId: string) => {
    // Xóa interval cũ của job này nếu có
    if (pollingIntervalRefs.current[sessionId]) {
      clearInterval(pollingIntervalRefs.current[sessionId]);
      delete pollingIntervalRefs.current[sessionId];
    }

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/image-generation/status/${jobId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to check job status");
        }

        // Cập nhật trạng thái loading session
        setLoadingSessions((prev) =>
          prev.map((session) => {
            if (session.sessionId === sessionId) {
              let status = "Queued...";

              switch (data.status) {
                case "pending":
                  status = "Job queued...";
                  break;
                case "processing":
                  status = data.progress.currentStep || "Processing...";
                  break;
                case "completed":
                  // Sẽ được xử lý bên dưới
                  break;
                case "failed":
                  status = `Failed: ${data.error || "Unknown error"}`;
                  break;
                case "cancelled":
                  status = "Cancelled";
                  break;
              }

              return { ...session, status };
            }
            return session;
          })
        );

        switch (data.status) {
          case "completed":
            await handleJobCompleted(jobId, sessionId);
            return;
          case "failed":
            handleJobFailed(data.error || "Job failed", sessionId);
            return;
          case "cancelled":
            handleJobCancelled(sessionId);
            return;
        }
      } catch (error) {
        handleJobFailed(error.message, sessionId);
      }
    };

    pollJob(); // Gọi ngay lần đầu

    // Tạo interval mới cho job này và lưu vào refs
    const interval = setInterval(pollJob, 4000);
    pollingIntervalRefs.current[sessionId] = interval;

    // Cập nhật state để React biết về việc thay đổi polling
    setPollingInterval(interval); // Vẫn giữ biến này cho backwards compatibility
  }, []);

  const stopJobPolling = useCallback((sessionId: string) => {
    if (pollingIntervalRefs.current[sessionId]) {
      clearInterval(pollingIntervalRefs.current[sessionId]);
      delete pollingIntervalRefs.current[sessionId];
    }
  }, []);

  // FIX: Improved handleJobCompleted
  const handleJobCompleted = async (jobId: string, sessionId: string) => {
    try {
      const response = await fetch(`/api/image-generation/results/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch job results");
      }

      await processJobResults(data, sessionId);
    } catch (error) {
      handleJobFailed(error.message, sessionId);
    } finally {
      // Dừng polling chỉ cho job này
      stopJobPolling(sessionId);
      removeLoadingSession(sessionId);
    }
  };

  const handleJobFailed = (error: string, sessionId: string) => {
    showNotification("error", "Generation Failed!", error);
    removeLoadingSession(sessionId);
  };

  const handleJobCancelled = (sessionId: string) => {
    removeLoadingSession(sessionId);
  };

  const removeLoadingSession = (sessionId: string) => {
    // Clear countdown interval
    if (sessionCountdownRefs.current[sessionId]) {
      clearInterval(sessionCountdownRefs.current[sessionId]);
      delete sessionCountdownRefs.current[sessionId];
    }

    // Clear polling interval
    if (pollingIntervalRefs.current[sessionId]) {
      clearInterval(pollingIntervalRefs.current[sessionId]);
      delete pollingIntervalRefs.current[sessionId];
    }

    // Xóa session khỏi loadingSessions
    setLoadingSessions((prev) =>
      prev.filter((session) => session.sessionId !== sessionId)
    );
  };

  const editPromptFromLoadingSession = (session: LoadingSession) => {
    if (session.prompt && textareaRef.current) {
      textareaRef.current.value = session.prompt;
      setPromptText(session.prompt);

      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
      adjustHeight();
    }
  };

  // FIX: Complete rewrite of processJobResults
  // ❌ XÓA toàn bộ code compress và convert blob

  // ✅ CODE MỚI - ĐƠN GIẢN HƠN NHIỀU
  const processJobResults = async (jobData: any, sessionId: string) => {
    try {
      const { results, claudeResponse } = jobData;
      // Tìm prompt từ loading session
      const loadingSession = loadingSessions.find(
        (session) => session.sessionId === sessionId
      );
      const promptFromLoadingSession = loadingSession?.prompt || "";

      // ✅ Filter chỉ lấy những ảnh thành công và hợp lệ
      const successfulImages = results
        .filter((img: any) => {
          // Kiểm tra có imageUrl hoặc imageBase64
          const imageUrl = img.imageUrl || img.imageBase64 || "";

          if (!imageUrl) {
            return false;
          }

          // Loại bỏ placeholder errors
          if (
            imageUrl.includes("PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM")
          ) {
            return false;
          }

          return true;
        })
        .map((img: any) => ({
          imageUrl: img.imageUrl || img.imageBase64,
          prompt: img.prompt || promptFromLoadingSession,
          category: img.category || selectedCategory.category,
          subCategory: img.subCategory || selectedCategory.subcategory,
          platform: img.platform || "",
          timestamp: img.timestamp || new Date().toISOString(),
          size: img.size || "Square",
          quality: img.quality || selectedQuality,
          claudeResponse: claudeResponse,
          AdCreativeA: img.AdCreativeA || "",
          AdCreativeB: img.AdCreativeB || "",
          targeting: img.targeting || "",
          imageName: img.imageName || "",
        }));

      if (successfulImages.length === 0) {
        showNotification(
          "warning",
          "Generation Failed!",
          "All images failed to generate. Please try again with a different prompt."
        );
        removeLoadingSession(sessionId);
        return;
      }

      // ✅ Sort images by prompt groups
      const sortedImages = sortImagesByPromptGroups(successfulImages);

      // ✅ Create new session for UI (không có blob conversion)
      const newSession = {
        sessionId: sessionId,
        clickedAt: Date.now(),
        currentImageIndex: 0,
        describe: promptFromLoadingSession || "Generated images",
        category: selectedCategory.category,
        subCategory: selectedCategory.subcategory,
        platform: successfulImages[0]?.platform || "",
        list: sortedImages, // ✅ Dùng trực tiếp URLs
      };

      // Update selectedSessions
      setSelectedSessions((prevSessions) => {
        const existingIndex = prevSessions.findIndex(
          (s) => s.sessionId === sessionId
        );

        if (existingIndex !== -1) {
          const updatedSessions = [...prevSessions];
          updatedSessions[existingIndex] = newSession;
          return updatedSessions;
        }

        return [newSession, ...prevSessions];
      });

      // Add first image to selectedImages
      if (sortedImages.length > 0) {
        setSelectedImages((prevImages) => {
          const firstImageObj = {
            imageUrl: sortedImages[0].imageUrl, // ✅ URL trực tiếp
            clickedAt: Date.now(),
            prompt: sortedImages[0].prompt,
            category: sortedImages[0].category,
            subCategory: sortedImages[0].subCategory,
            platform: sortedImages[0].platform,
            size: sortedImages[0].size,
            quality: sortedImages[0].quality,
            sessionId: sessionId,
            imageIndex: 0,
            claudeResponse: sortedImages[0].claudeResponse,
            AdCreativeA: sortedImages[0].AdCreativeA,
            AdCreativeB: sortedImages[0].AdCreativeB,
            targeting: sortedImages[0].targeting,
            imageName: sortedImages[0].imageName,
          };

          // Remove any existing images from this session
          const filteredImages = prevImages.filter(
            (img) => img.sessionId !== sessionId
          );

          const loadingItems = filteredImages.filter((img) =>
            loadingSessions.some(
              (session) => session.sessionId === img.sessionId
            )
          );

          const regularItems = filteredImages.filter(
            (img) =>
              !loadingSessions.some(
                (session) => session.sessionId === img.sessionId
              )
          );

          return [...loadingItems, firstImageObj, ...regularItems].slice(
            0,
            gridItemCount
          );
        });
      }

      // ✅ Không dispatch historyUpdated event nữa vì không lưu local

      showNotification(
        "success",
        "Images Generated!",
        `Successfully generated ${successfulImages.length} image${
          successfulImages.length > 1 ? "s" : ""
        }`
      );
    } catch (error) {
      showNotification(
        "error",
        "Processing Error!",
        "Failed to process generated images. Please try again."
      );
      removeLoadingSession(sessionId);
      throw error;
    } finally {
      removeLoadingSession(sessionId);
    }
  };

  const cancelImageGeneration = async (sessionId?: string) => {
    if (!sessionId && loadingSessions.length > 0) {
      // Cancel session mới nhất nếu không có sessionId
      sessionId = loadingSessions[loadingSessions.length - 1].sessionId;
    }

    if (!sessionId) return;

    const loadingSession = loadingSessions.find(
      (session) => session.sessionId === sessionId
    );

    if (loadingSession?.jobId) {
      try {
        await fetch(`/api/image-generation/cancel/${loadingSession.jobId}`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Error cancelling job:", error);
      }
    }

    removeLoadingSession(sessionId);
  };

  const startSessionCountdown = (sessionId: string) => {
    // Tạo interval cho session này
    const intervalId = setInterval(() => {
      setLoadingSessions((prev) =>
        prev.map((session) => {
          if (session.sessionId === sessionId) {
            return { ...session, countdown: session.countdown + 1 };
          }
          return session;
        })
      );
    }, 1000);

    // Lưu intervalId để có thể clear sau này
    sessionCountdownRefs.current[sessionId] = intervalId;
  };

  const handleFormSubmit = async () => {
  if (!promptText.trim()) {
    return;
  }

  const sessionId = `session-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  
  let finalPrompt = promptText.trim();
  let shouldClearInput = true; // ✅ Flag để quyết định có clear input không

  // ✅ BƯỚC 1: Optimize prompt NẾU CÓ instructionsSubcategory
  if (instructionsSubcategory) {
    shouldClearInput = false; // ✅ KHÔNG clear input khi có optimize
    
    try {
      console.log("🔄 Step 1: Optimizing prompt with instructions...");
      
      // Show optimizing status
      const optimizingSession = {
        sessionId: `optimizing-${sessionId}`,
        prompt: "Optimizing your prompt...",
        category: selectedCategory.category,
        subCategory: selectedCategory.subcategory,
        startTime: Date.now(),
        jobId: null,
        countdown: 0,
      };
      setLoadingSessions((prev) => [optimizingSession, ...prev]);
      startSessionCountdown(optimizingSession.sessionId);

      const optimizeResponse = await fetch(
        "https://n8n.misencorp.com/webhook/optimize-prompt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: finalPrompt,
            instructions: {
              category: "instructions",
              subcategory: instructionsSubcategory || "",
              user_prompt: instructionsApiData.user_prompt,
              system_prompt: instructionsApiData.system_prompt,
            },
          }),
        }
      );

      if (!optimizeResponse.ok) {
        throw new Error(`Optimize API failed: ${optimizeResponse.status}`);
      }

      const optimizeData = await optimizeResponse.json();

      if (optimizeData && optimizeData[0]?.message?.content) {
        finalPrompt = optimizeData[0].message.content;
        console.log("✅ Step 1 Complete: Prompt optimized");
        
        // ✅ Update textarea với optimized prompt và GIỮ LẠI
        if (textareaRef.current) {
          textareaRef.current.value = finalPrompt;
          setPromptText(finalPrompt);
          adjustHeight();
        }

        showNotification(
          "success",
          "Prompt Optimized!",
          "Your prompt has been improved and will be used for generation."
        );
      }

      // Remove optimizing session
      removeLoadingSession(optimizingSession.sessionId);

    } catch (error) {
      console.error("⚠️ Optimize failed, using original prompt:", error);
      removeLoadingSession(`optimizing-${sessionId}`);
      
      showNotification(
        "warning",
        "Optimization Skipped",
        "Using your original prompt to generate images."
      );
    }
  }

  // ✅ BƯỚC 2: Generate image với finalPrompt
  console.log("🚀 Step 2: Generating images with prompt:", finalPrompt);

  const currentPromptText = finalPrompt;

  // Create loading session
  const newLoadingSession = {
    sessionId,
    prompt: currentPromptText,
    category: selectedCategory.category,
    subCategory: selectedCategory.subcategory,
    startTime: Date.now(),
    jobId: null,
    countdown: 0,
  };

  setLoadingSessions((prev) => [newLoadingSession, ...prev]);
  setCurrentLoadingPrompt(currentPromptText);
  startSessionCountdown(sessionId);

  // ✅ CHỈ CLEAR input khi KHÔNG có instructionsSubcategory
  if (shouldClearInput) {
    console.log("🗑️ Clearing input (no instructions subcategory)");
    setPromptText("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
      adjustHeight();
    }
  } else {
    console.log("📌 Keeping optimized prompt in input");
  }

  try {
    let uploadedImageUrls: string[] = [];

    if (uploadedImages.length > 0) {
      console.log(
        `📤 Uploading ${uploadedImages.length} reference images...`
      );

      const uploadPromises = uploadedImages.map(
        async (base64Image, index) => {
          try {
            const blob = await fetch(base64Image).then((r) => r.blob());

            const formData = new FormData();
            formData.append("filename", blob, `reference-image-${index}.png`);

            const response = await fetch(
              "https://prod.api.market/api/v1/magicapi/image-upload/upload",
              {
                method: "POST",
                headers: {
                  "x-magicapi-key": "cmfxojr010001jo04ld19izzv",
                },
                body: formData,
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              console.error(
                `❌ Upload failed for image ${index}:`,
                errorText
              );
              return null;
            }

            const data = await response.json();
            return data.url;
          } catch (error) {
            return null;
          }
        }
      );

      const results = await Promise.all(uploadPromises);
      uploadedImageUrls = results.filter((url) => url !== null) as string[];

      if (uploadedImageUrls.length === 0) {
        throw new Error("All image uploads failed");
      }
    }

    const instructionResponse = await fetch("/api/instructions/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: selectedCategory.category,
        subcategory: selectedCategory.subcategory || "",
        selectedModel: selectedApis[0] || "claude-sonnet",
      }),
    });

    if (!instructionResponse.ok) {
      throw new Error("Failed to load instructions");
    }

    const instructionData = await instructionResponse.json();

    const generateResponse = await fetch(
      "https://n8n.misencorp.com/webhook/ms-image-generator",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userPrompt: currentPromptText,
          userPromptInstruction: parseContent(instructionData.user_prompt).promptContent,
          systemPromptInstruction: parseContent(instructionData.system_prompt).instructions,
          uploadedImageUrls,
          numberOfImages,
          imageSizesString: generateImageSizesString(),
          selectedQuality,
          selectedCategory: {
            category: selectedCategory.category,
            subcategory: selectedCategory.subcategory || "",
          },
          selectedInstructions: {
            category: "instructions",
            subcategory: instructionsSubcategory || "",
            user_prompt: instructionsApiData.user_prompt,
            system_prompt: instructionsApiData.system_prompt,
          },
          selectedApis,
          selectedAspectRatio,
          userRole: currentUser?.role || 'content',
        }),
      }
    );

    if (!generateResponse.ok) {
      throw new Error(`N8N webhook failed: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();
    const jobId = generateData[0]?.job_id;

    if (!jobId) {
      throw new Error("No jobId received from N8N");
    }

    setLoadingSessions((prev) =>
      prev.map((session) =>
        session.sessionId === sessionId ? { ...session, jobId } : session
      )
    );

    let pollAttempts = 0;
    const maxPollAttempts = 120;
    let generateImagePool: NodeJS.Timeout;

    const pollForResults = async () => {
      try {
        pollAttempts++;

        const response = await fetch(
          `https://n8n.misencorp.com/webhook/get_image_queue?job_id=${jobId}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`Poll request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data[0].job_id) {
          clearInterval(generateImagePool);
          removeLoadingSession(sessionId);
          showNotification(
            "error",
            "Server Busy!",
            "The server is currently busy. Please try again in a few moments."
          );
          return;
        }

        if (data && data[0] && data[0].data != null) {
          clearInterval(generateImagePool);

          const imagesData = data[0].data;

          let allImages: any[] = [];

          if (Array.isArray(imagesData)) {
            allImages = imagesData.flatMap((platformData: any) =>
              (platformData.images || []).map((img: any) => ({
                imageUrl: img.url || "",
                prompt: img.prompt || currentPromptText,
                category: selectedCategory.category,
                subCategory: selectedCategory.subcategory || "",
                size: img.size || "Square",
                quality: selectedQuality,
                timestamp: new Date().toISOString(),
                claudeResponse: img.claudeResponse || "",
                AdCreativeA: img.AdCreativeA || "",
                AdCreativeB: img.AdCreativeB || "",
                targeting: img.targeting || "",
                imageName: img.imageName || "",
              }))
            );
          } else if (imagesData && typeof imagesData === "object") {
            const urls = Array.isArray(imagesData.url) ? imagesData.url : [];
            const prompts = Array.isArray(imagesData.prompt)
              ? imagesData.prompt
              : [];
            const maxLength = Math.max(urls.length, prompts.length);

            allImages = Array.from({ length: maxLength }, (_, index) => ({
              imageUrl: urls[index] || "",
              prompt: prompts[index] || currentPromptText,
              category: imagesData.category || selectedCategory.category,
              subCategory:
                imagesData.sub_category || selectedCategory.subcategory || "",
              platform: imagesData.platform || "",
              size: "Square",
              quality: selectedQuality,
              timestamp: new Date().toISOString(),
              claudeResponse: "",
              AdCreativeA: "",
              AdCreativeB: "",
              targeting: "",
              imageName: "",
            }));
          } else {
            console.error("❌ Unknown data format:", imagesData);
          }

          const validImages = allImages.filter(
            (img: any) =>
              img.imageUrl &&
              !img.imageUrl.includes(
                "PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIueG1sbnM"
              ) &&
              img.imageUrl !==
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTkiPkVycm9yPC90ZXh0Pjwvc3ZnPg=="
          );

          if (validImages.length === 0) {
            showNotification(
              "error",
              "Generation Failed!",
              "Failed to process generated images. Please try again."
            );
            removeLoadingSession(sessionId);
            return;
          }

          const sortedValidImages = sortImagesByPromptGroups(validImages);
          const newSession = {
            sessionId: sessionId,
            clickedAt: Date.now(),
            currentImageIndex: 0,
            describe: currentPromptText,
            category: selectedCategory.category,
            subCategory: selectedCategory.subcategory || "",
            platform: sortedValidImages[0]?.platform || "",
            list: sortedValidImages,
          };

          setSelectedSessions((prevSessions) => {
            const existingIndex = prevSessions.findIndex(
              (s) => s.sessionId === sessionId
            );

            if (existingIndex !== -1) {
              const updatedSessions = [...prevSessions];
              updatedSessions[existingIndex] = newSession;
              return updatedSessions;
            }

            return [newSession, ...prevSessions];
          });

          if (sortedValidImages.length > 0) {
            setSelectedImages((prevImages) => {
              const firstImageObj = {
                imageUrl: sortedValidImages[0].imageUrl,
                clickedAt: Date.now(),
                prompt: sortedValidImages[0].prompt,
                category: sortedValidImages[0].category,
                subCategory: sortedValidImages[0].subCategory,
                size: sortedValidImages[0].size,
                quality: sortedValidImages[0].quality,
                sessionId: sessionId,
                imageIndex: 0,
                claudeResponse: sortedValidImages[0].claudeResponse,
                AdCreativeA: sortedValidImages[0].AdCreativeA,
                AdCreativeB: sortedValidImages[0].AdCreativeB,
                targeting: sortedValidImages[0].targeting,
                imageName: sortedValidImages[0].imageName,
              };

              const filteredImages = prevImages.filter(
                (img) => img.sessionId !== sessionId
              );

              const loadingItems = filteredImages.filter((img) =>
                loadingSessions.some(
                  (session) => session.sessionId === img.sessionId
                )
              );

              const regularItems = filteredImages.filter(
                (img) =>
                  !loadingSessions.some(
                    (session) => session.sessionId === img.sessionId
                  )
              );

              const updatedImages = [
                ...loadingItems,
                firstImageObj,
                ...regularItems,
              ].slice(0, gridItemCount);

              return updatedImages;
            });
          }
          removeLoadingSession(sessionId);

          showNotification(
            "success",
            "Images Generated!",
            `Successfully generated ${sortedValidImages.length} image${
              sortedValidImages.length > 1 ? "s" : ""
            }`
          );
        } else if (pollAttempts >= maxPollAttempts) {
          clearInterval(generateImagePool);

          showNotification(
            "error",
            "Generation Timeout!",
            "Image generation took too long. Please try again."
          );

          removeLoadingSession(sessionId);
        } else {
          console.log("⏳ Results not ready yet, continuing polling...");
        }
      } catch (error) {
        clearInterval(generateImagePool);

        showNotification(
          "error",
          "Generation Failed!",
          "An error occurred while generating images. Please try again."
        );

        removeLoadingSession(sessionId);
      }
    };

    generateImagePool = setInterval(pollForResults, 5000);
    pollForResults();
  } catch (error: any) {
    setLoadingSessions((prev) =>
      prev.filter((session) => session.sessionId !== sessionId)
    );

    showNotification(
      "error",
      "Submission Failed!",
      error.message || "Failed to start image generation. Please try again."
    );
  }
};

  // ✅ CODE MỚI
  useEffect(() => {
    return () => {
      // Clear tất cả các countdown intervals
      Object.values(sessionCountdownRefs.current).forEach((intervalId) => {
        clearInterval(intervalId);
      });

      // Clear tất cả các polling intervals
      Object.values(pollingIntervalRefs.current).forEach((intervalId) => {
        clearInterval(intervalId);
      });

      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      // ✅ Không cần cleanup blob URLs nữa
    };
  }, []);

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
          session.list[i].imageUrl === currentImage.imageUrl && // ✅ FIX
          session.list[i].prompt === currentImage.prompt
        ) {
          currentImageIndexInSession = i;
          break;
        }
      }

      // ❌ FIX 2: Đổi imageBase64 → imageUrl
      if (currentImageIndexInSession === -1) {
        currentImageIndexInSession = session.list.findIndex(
          (img) => img.imageUrl === currentImage.imageUrl // ✅ FIX
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

    // ✅ Đoạn này user đã sửa đúng rồi (nếu dùng imageUrl)
    const nextImageObject = {
      imageUrl: nextImageData.imageUrl, // ✅ OK nếu đã là imageUrl
      clickedAt: Date.now(),
      prompt: nextImageData.prompt,
      category: nextImageData.category,
      subCategory: nextImageData.subCategory,
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
    console.log(item);
    // Validate input
    if (!item.list || item.list.length === 0) {
      console.log("⚠️ No images found in this session");
      return;
    }

    console.log("📥 History item clicked:", {
      sessionId: item.sessionId,
      imageCount: item.list.length,
      firstImageUrl: item.list[0]?.imageUrl,
      category: item.category,
      subCategory: item.subCategory,
    });

    // ✅ Sort images by prompt groups
    const sortedList = sortImagesByPromptGroups(item.list);

    // ✅ Map với field names ĐÚNG
    const newSession = {
      sessionId: item.sessionId,
      clickedAt: Date.now(),
      currentImageIndex: 0,
      describe: item.describe || "Image session",
      category: item.category || "", // ✅ THÊM category
      subCategory: item.subCategory || "", // ✅ THÊM subCategory
      platform: item.platform || "",
      list: sortedList.map((img: any) => ({
        imageUrl: img.imageUrl || "", // ✅ DÙNG imageUrl, không phải imageBase64
        prompt: img.prompt || "",
        category: img.category || item.category || "", // ✅ THAY platform
        subCategory: img.subCategory || item.subCategory || "", // ✅ THÊM
        platform: item.platform || "",
        claudeResponse: img.claudeResponse || "",
        timestamp: img.timestamp || new Date().toISOString(),
        size: img.size || "Square",
        quality: img.quality || "Standard",
        AdCreativeA: img.AdCreativeA || "",
        AdCreativeB: img.AdCreativeB || "",
        targeting: img.targeting || "",
        imageName: img.imageName || "",
      })),
    };

    console.log(`✅ Adding new session to selectedSessions: ${item.sessionId}`);

    // Update selectedSessions
    setSelectedSessions((prevSessions) => {
      // Double-check to prevent duplicates
      if (prevSessions.some((s) => s.sessionId === item.sessionId)) {
        console.log("🔄 Session already exists, skipping");
        return prevSessions;
      }
      return [newSession, ...prevSessions];
    });

    // Add first image to grid
    const firstImage = sortedList[0];

    const newImageObj = {
      imageUrl: firstImage.imageUrl, // ✅ DÙNG imageUrl, không phải imageBase64
      clickedAt: Date.now(),
      prompt: firstImage.prompt || "",
      category: firstImage.category || item.category || "", // ✅ THAY platform
      subCategory: firstImage.subCategory || item.subCategory || "", // ✅ THÊM
      platform: firstImage.platform || item.platform || "",
      size: firstImage.size || "Square",
      quality: firstImage.quality || "Standard",
      sessionId: item.sessionId,
      imageIndex: 0,
      claudeResponse: firstImage.claudeResponse || "",
      AdCreativeA: firstImage.AdCreativeA || "",
      AdCreativeB: firstImage.AdCreativeB || "",
      targeting: firstImage.targeting || "",
      imageName: firstImage.imageName || "",
    };

    console.log("🖼️ Adding first image to grid:", {
      imageUrl: newImageObj.imageUrl,
      hasUrl: !!newImageObj.imageUrl,
      category: newImageObj.category,
      subCategory: newImageObj.subCategory,
    });

    // Add to selectedImages
    setSelectedImages((prevImages) => {
      // Check if image already exists
      if (
        prevImages.some(
          (img) => img.sessionId === item.sessionId && img.imageIndex === 0
        )
      ) {
        console.log("⚠️ Image already exists in grid, will not add duplicate");
        return prevImages;
      }

      const updatedImages = [newImageObj, ...prevImages];

      // Expand grid if needed
      if (updatedImages.length > baseGridCount) {
        setExpandedGrid(true);
        setGridItemCount(updatedImages.length);
      }

      return updatedImages;
    });
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

  // ✅ CODE MỚI (bỏ phần revoke blob)
  const removeSelectedImage = (indexToRemove: number) => {
    const imageToRemove = selectedImages[indexToRemove];

    // ✅ Không cần revoke vì dùng URL trực tiếp

    // Update selectedImages state
    setSelectedImages((prevImages) =>
      prevImages.filter((_, index) => index !== indexToRemove)
    );

    // Remove from sessions if this is the last image from this session
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

    // Update viewer state if needed
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

  // ✅ CODE MỚI - ĐƠN GIẢN
  const clearAllImages = () => {
    // ✅ Không cần cleanup blob URLs nữa

    setSelectedImages([]);
    setSelectedSessions([]);
    setCurrentViewImageIndex(null);
    setCurrentSessionId(null);
  };

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
          // ✅ FIX: Đổi imageBase64 → imageUrl
          const imageIndex = session.list.findIndex(
            (img) => img.imageUrl === selectedImage.imageUrl
          );
          if (imageIndex !== -1) {
            setCurrentSessionImageIndex(imageIndex);
          }
        }
      }
    } else {
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

    // ✅ Sort list trước khi navigate
    const sortedList = sortImagesByPromptGroups(currentSession.list);

    let newIndex;
    if (direction === "prev") {
      newIndex =
        currentSessionImageIndex === 0
          ? sortedList.length - 1
          : currentSessionImageIndex - 1;
    } else {
      newIndex =
        currentSessionImageIndex === sortedList.length - 1
          ? 0
          : currentSessionImageIndex + 1;
    }

    setCurrentSessionImageIndex(newIndex);

    const newImageData = currentSession.list[newIndex];

    const existingImageIndex = selectedImages.findIndex(
      (img) =>
        img.sessionId === currentSessionId &&
        img.imageUrl === newImageData.imageUrl // ✅ ĐỔI từ imageBase64
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
      // Convert HTML to plain text if needed
      let cleanPrompt = prompt;
      if (prompt.includes("<") && prompt.includes(">")) {
        const div = document.createElement("div");
        div.innerHTML = prompt
          .replace(/<(li|h[1-6]|p|div)>/gi, "\n\n<$1>")
          .replace(/<br\s*\/?>/gi, "\n\n");
        cleanPrompt = div.innerText
          .replace(/\n{2,}/g, "\n\n")
          .replace(/^\n+|\n+$/g, "");
      }

      textareaRef.current.value = cleanPrompt;
      setPromptText(cleanPrompt);
      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
      adjustHeight();
    }
  };

  const generateRandomFilename = (): string => {
    // Generate random hex string (a-f, 0-9)
    const randomHex = (length: number): string => {
      let result = '';
      const characters = '0123456789abcdef';
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    };

    // Format: 6-4-4-4-6 (e.g., 1a91a4-fc96-4d75-8d91-7a0fc2)
    const segments = [
      randomHex(6),
      randomHex(4),
      randomHex(4),
      randomHex(4),
      randomHex(6)
    ];

    return segments.join('-');
  };

  const downloadImage = async (imageUrl, claudeResponse = "", imageIndex = "", imageName = "") => {
  try {
    const randomName = generateRandomFilename();
    
    // Detect if image is webp
    const isWebp = imageUrl.includes('.webp') || imageUrl.includes('artguru');
    
    // Always use PNG extension for webp images
    const extension = isWebp ? '.png' : 
                     imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') ? '.jpg' : 
                     imageUrl.includes('.gif') ? '.gif' : '.png';
    
    const fileName = `${randomName}${extension}`;
    
    console.log('📥 Downloading:', { fileName, isWebp, imageUrl });

    // Base64 - direct download
    if (imageUrl.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // ✅ NEW: Convert webp to PNG using canvas
    if (isWebp) {
      try {
        console.log('🔄 Converting webp to PNG...');
        const pngBlob = await convertWebpToPng(imageUrl);
        const blobUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        console.log('✅ Webp converted to PNG successfully');
        return;
      } catch (conversionError) {
        console.error('❌ Webp conversion failed, trying fallback:', conversionError);
        // Fallback to proxy if conversion fails
      }
    }

    // Try direct fetch for non-webp images
    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Direct fetch failed");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      return;
    } catch (directError) {
      // Fallback to proxy
      console.log("Direct fetch failed, trying proxy...");
      const proxyUrl = `/api/proxy-image-direct?url=${encodeURIComponent(imageUrl)}`;
      const proxyResponse = await fetch(proxyUrl);

      if (!proxyResponse.ok) throw new Error("Proxy fetch failed");

      const blob = await proxyResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.error("All download methods failed:", error);
    window.open(imageUrl, "_blank");
  }
};

// ✅ ADD THIS NEW FUNCTION
const convertWebpToPng = async (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas with image dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0);
        
        // Convert to PNG blob with maximum quality
        canvas.toBlob((blob) => {
          if (blob) {
            console.log(`✅ Converted to PNG: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(blob);
          } else {
            reject(new Error('Failed to convert to PNG blob'));
          }
        }, 'image/png', 1.0); // 1.0 = maximum quality
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      reject(new Error('Failed to load image for conversion'));
    };
    
    // Handle CORS issues
    img.src = imageUrl;
  });
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
      const maxHeight = 400;
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
    const words = cleaned.split("-");
    let result = "";

    for (let i = 0; i < words.length; i++) {
      const wordToAdd = i === 0 ? words[i] : "-" + words[i];

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

    // Different colors for different types
    const colors = {
      error: { bg: "#ff6b6b", text: "white" },
      warning: { bg: "#f39c12", text: "white" },
      success: { bg: "#4CAF50", text: "white" },
      info: { bg: "#3498db", text: "white" },
    };

    const color = colors[type as keyof typeof colors] || colors.info;

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
        font-family: Arial, sans-serif;
      ">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <strong style="font-size: 16px;">${title}</strong>
          ${
            type === "success"
              ? "✅"
              : type === "warning"
              ? "⚠️"
              : type === "error"
              ? "❌"
              : "ℹ️"
          }
        </div>
        <div style="font-size: 14px; line-height: 1.4; margin-bottom: 12px;">
          ${message}
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: white; 
          color: ${color.bg}; 
          border: none; 
          padding: 6px 12px; 
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
          transition: opacity 0.2s;
        " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
          OK
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after delay
    const autoRemoveDelay =
      type === "error" ? 8000 : type === "warning" ? 6000 : 4000;
    setTimeout(() => {
      if (notification.parentElement) {
        document.body.removeChild(notification);
      }
    }, autoRemoveDelay);
  };

  const SafeImage: React.FC<{
    src: string;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
    selectedImages?: any[];
    selectedSessions?: any[];
  }> = ({ src, alt, className, style, onClick }) => {
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

  // ✅ Calculate isEnhanced dynamically when image changes
  const isCurrentImageEnhanced = useMemo(() => {
    if (currentViewImageIndex === null) return false;
    
    let imageUrl = "";
    
    if (currentSessionId) {
      const session = selectedSessions.find(
        (s) => s.sessionId === currentSessionId
      );
      if (session && session.list[currentSessionImageIndex]) {
        imageUrl = session.list[currentSessionImageIndex].imageUrl || "";
      }
    } else if (selectedImages[currentViewImageIndex]) {
      imageUrl = selectedImages[currentViewImageIndex].imageUrl || "";
    }
    
    const isEnhanced = imageUrl.includes("img.artguru.ai");
    console.log("🔍 Check enhanced:", { imageUrl, isEnhanced });
    
    return isEnhanced;
  }, [currentSessionId, currentSessionImageIndex, currentViewImageIndex, selectedSessions, selectedImages]);

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

            {showRegisterModal && currentUser?.role === 'Admin' && (
              <RegisterModal
                onClose={() => setShowRegisterModal(false)}
                onSuccess={() => {
                  setShowRegisterModal(false);
                  showNotification(
                    "success",
                    "User Created!",
                    "New user has been registered successfully."
                  );
                }}
              />
            )}

          <div
            className={`container-wrapper ${
              showHistorySidebar ? "shifted" : ""
            }`}
          >
            <div className="container-7">
              <div className="horizontal-border-2">
                <div className="heading-images-2">Images</div>

                <div className="flex">
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
                  {loadingSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className="image-items image-item-loading"
                      data-session-id={session.sessionId}
                    >
                      <div className="loading-container">
                        <button
                          className="loading-close-btn"
                          onClick={() =>
                            cancelImageGeneration(session.sessionId)
                          }
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
                        <div className="loading-time">{session.countdown}s</div>
                        <button
                          className="loading-edit-btn"
                          onClick={() => editPromptFromLoadingSession(session)}
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
                          {session.prompt
                            ? getFirst10Words(session.prompt)
                            : "Generating..."}
                        </div>
                      </div>
                    </div>
                  ))}

                  {sortImagesByPromptGroups(selectedImages).map(
                    (img, sortedIndex) => {
                      // Tìm index gốc trong selectedImages array
                      const originalIndex = selectedImages.findIndex(
                        (original) =>
                          original.imageUrl === img.imageUrl &&
                          original.clickedAt === img.clickedAt
                      );

                      return (
                        <div
                          key={`img-${sortedIndex}-${img.clickedAt}`}
                          className={`image-items image-item-${
                            sortedIndex + 1
                          }`}
                          onClick={() => viewImage(originalIndex)}
                        >
                          {(() => {
                            if (img.sessionId) {
                              const session = selectedSessions.find(
                                (s) => s.sessionId === img.sessionId
                              );
                              if (session && session.list.length > 1) {
                                return (
                                  <div className="overlay-item-count">
                                    {session.list.length}
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}

                          {(img.category || img.subCategory) && (
                            <div className="category-label category-label-grid">
                              {img.category && img.subCategory
                                ? `${img.category}/${img.subCategory}`
                                : img.category || img.subCategory}
                            </div>
                          )}

                          <img
                            src={img.imageUrl}
                            alt={`Generated image ${sortedIndex + 1}`}
                            loading="lazy" // ✅ Lazy loading cho performance
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />

                          <div className="image-actions-overlay">
                            <div className="actions-header">
                              <button
                                className="image-remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSelectedImage(originalIndex);
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
                                {hasMultipleInSession(originalIndex) && (
                                  <>
                                    <button
                                      className="image-nav-btn prev"
                                      onClick={(e) =>
                                        navigateImageThumbnail(
                                          originalIndex,
                                          "prev",
                                          e
                                        )
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
                                        navigateImageThumbnail(
                                          originalIndex,
                                          "next",
                                          e
                                        )
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
                                    const image = selectedImages[originalIndex];
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
                                      let textToCopy = promptText;
                                      if (
                                        promptText.includes("<") &&
                                        promptText.includes(">")
                                      ) {
                                        const div =
                                          document.createElement("div");
                                        div.innerHTML = promptText
                                          .replace(
                                            /<(li|h[1-6]|p|div)>/gi,
                                            "\n\n<$1>"
                                          )
                                          .replace(/<br\s*\/?>/gi, "\n\n");
                                        textToCopy = div.innerText
                                          .replace(/\n{2,}/g, "\n\n")
                                          .replace(/^\n+|\n+$/g, "");
                                      }

                                      navigator.clipboard
                                        .writeText(textToCopy)
                                        .then(() => {
                                          const notification =
                                            document.createElement("div");
                                          notification.textContent =
                                            "Prompt copied!";
                                          notification.className =
                                            "copy-notification";
                                          document.body.appendChild(
                                            notification
                                          );
                                          setTimeout(() => {
                                            document.body.removeChild(
                                              notification
                                            );
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
                                    const image = selectedImages[originalIndex];
                                    let claudeResponse = "";
                                    let imageIndex = 0;
                                    let imageName = "";

                                    if (image.sessionId) {
                                      const session = selectedSessions.find(
                                        (s) => s.sessionId === image.sessionId
                                      );

                                      if (session) {
                                        if (image.imageIndex !== undefined) {
                                          imageIndex = image.imageIndex;
                                          const imageData =
                                            session.list[imageIndex];
                                          imageName =
                                            imageData?.imageName || "";
                                          claudeResponse =
                                            imageData?.claudeResponse || "";
                                        } else {
                                          const foundIndex =
                                            session.list.findIndex(
                                              (img) =>
                                                img.imageUrl ===
                                                  image.imageUrl ||
                                                img.prompt === image.prompt
                                            );
                                          if (foundIndex !== -1) {
                                            imageIndex = foundIndex;
                                            const imageData =
                                              session.list[foundIndex];
                                            imageName =
                                              imageData?.imageName || "";
                                            claudeResponse =
                                              imageData?.claudeResponse || "";
                                          }
                                        }
                                      }
                                    } else {
                                      imageName = image.imageName || "";
                                      claudeResponse =
                                        image.claudeResponse || "";
                                    }

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
                      );
                    }
                  )}

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
                    {instructionsContent && (
                      <div className="instructions-preview-box">
                        <div className="instructions-preview-header">
                          <span className="instructions-preview-title">
                            📝 Active Instructions
                          </span>
                          <button
                            className="instructions-preview-collapse"
                            onClick={() => setInstructionsContent("")}
                            title="Hide instructions"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="instructions-preview-content">
                          {instructionsContent.substring(0, 200)}
                          {instructionsContent.length > 200 && "..."}
                        </div>
                      </div>
                    )}

                    <div className="textarea-2">
                      <textarea
                        ref={textareaRef}
                        className="input-prompt"
                        placeholder="Describe what you want to see..."
                        maxLength={2000}
                        onInput={(e) =>
                          setPromptText((e.target as HTMLTextAreaElement).value)
                        }
                        onKeyPress={handleKeyPress}
                      ></textarea>

                      {/* ✅ THÊM CHARACTER COUNTER */}
                      {promptText && (
                        <div style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '12px',
                          fontSize: '11px',
                          color: promptText.length > 2800 ? '#ef4444' : '#999',
                          pointerEvents: 'none'
                        }}>
                          {promptText.length}/2000
                        </div>
                      )}
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
                          onApiChange={handleApiChange}
                          onAspectRatioChange={handleAspectRatioChange} // ✅ THÊM MỚI
                          currentUser={currentUser}
                        />

                        {
                          <div
                            className="button-6 bg-white rounded-full"
                            onClick={handleUploadClick}
                          >
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
                        }
                      </div>

                      <div className="flex gap-2">
                      <div
                        className={`button-7 ${
                          promptText.trim() ? "active" : ""
                        }`}
                        onClick={
                          promptText.trim() ? handleFormSubmit : undefined
                        }
                        ref={submitButtonRef}
                      >
                        <img
                          className="SVG-6"
                          alt="Svg"
                          src="/img/svg-4.svg"
                        />
                      </div>
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
                currentUser={currentUser} 
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
            <div className="flex gap-2.5">
              <div className="container-9">
                <div className="container-10">
                  <div className="text-wrapper-9">AI IMAGE</div>
                </div>
              </div>

              <img className="SVG-7" alt="Svg" src="/img/svg-14.svg" />
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
              <div
                className="link-6"
                onClick={handleNavigateToProjectManagement}
              >
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
                      {currentUser?.role === 'Admin' && (
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setShowUserDropdown(false);
                            setShowRegisterModal(true);
                          }}
                        >
                          Register User
                        </button>
                      )}
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
                  {(() => {
                    let category = "";
                    let subCategory = "";

                    if (currentSessionId) {
                      const session = selectedSessions.find(
                        (s) => s.sessionId === currentSessionId
                      );
                      if (session && session.list[currentSessionImageIndex]) {
                        category =
                          session.list[currentSessionImageIndex].category ||
                          session.category ||
                          "";
                        subCategory =
                          session.list[currentSessionImageIndex].subCategory ||
                          session.subCategory ||
                          "";
                      }
                    }

                    return category || subCategory ? (
                      <div className="category-label category-label-viewer">
                        {category && subCategory
                          ? `${category}/${subCategory}`
                          : category || subCategory}
                      </div>
                    ) : null;
                  })()}

                  {(() => {
                    let platform = "";

                    if (currentSessionId) {
                      const session = selectedSessions.find(
                        (s) => s.sessionId === currentSessionId
                      );
                      if (session && session.list[currentSessionImageIndex]) {
                        platform =
                          session.list[currentSessionImageIndex].platform ||
                          session.platform ||
                          "";
                      }
                    }

                    return platform ? (
                      <div className="platform-label platform-label-viewer">
                        {platform}
                      </div>
                    ) : null;
                  })()}

                  {currentSessionId &&
                    (() => {
                      const session = selectedSessions.find(
                        (s) => s.sessionId === currentSessionId
                      );

                      if (session && session.list[currentSessionImageIndex]) {
                        const sortedList = sortImagesByPromptGroups(
                          session.list
                        );
                        const currentImage =
                          sortedList[currentSessionImageIndex];

                        return (
                          <img
                            src={currentImage.imageUrl} // ✅ ĐỔI từ imageBase64
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
                      <span className="session-possition-text">
                        {currentSessionId &&
                          (() => {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.list.length > 0) {
                              return `${currentSessionImageIndex + 1}/${
                                session.list.length
                              }`;
                            } else {
                              return "1/1";
                            }
                          })()}
                      </span>

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

                      <svg 
                        className={`button-enhance ${isEnhancing ? 'enhancing' : ''} ${isCurrentImageEnhanced ? 'enhanced' : ''}`}
                        xmlns="http://www.w3.org/2000/svg"
                        width="1em"
                        height="1em"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        onClick={handleEnhanceImage}
                        style={{ 
                          cursor: isEnhancing ? 'not-allowed' : 'pointer',
                          pointerEvents: isEnhancing ? 'none' : 'auto'
                        }}
                        title={isCurrentImageEnhanced ? "Already enhanced" : "Enhance image"}
                      >
                        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 22.5l-.394-1.933a2.25 2.25 0 00-1.423-1.423L12.75 18.75l1.933-.394a2.25 2.25 0 001.423-1.423l.394-1.933.394 1.933a2.25 2.25 0 001.423 1.423l1.933.394-1.933.394a2.25 2.25 0 00-1.423 1.423z"/>
                      </svg>

                      <button
                        className="image-viewer-download"
                        onClick={() => {
                          if (
                            currentSessionId &&
                            currentViewImageIndex !== null
                          ) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );

                            if (
                              session &&
                              session.list[currentSessionImageIndex]
                            ) {
                              const imageData =
                                session.list[currentSessionImageIndex];
                              downloadImage(
                                imageData.imageUrl, // ✅ ĐỔI TỪ imageBase64 THÀNH imageUrl
                                imageData.claudeResponse,
                                currentSessionImageIndex,
                                imageData.imageName
                              );
                            } else if (selectedImages[currentViewImageIndex]) {
                              const imageData =
                                selectedImages[currentViewImageIndex];
                              downloadImage(
                                imageData.imageUrl,
                                imageData.claudeResponse,
                                imageData.imageIndex || 0,
                                imageData.imageName
                              );
                            }
                          }
                        }}
                        title="Download image"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="1em"
                          height="1em"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M7.707 10.293a1 1 0 1 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0-1.414-1.414L13 13.586V4a1 1 0 1 0-2 0v9.586l-3.293-3.293ZM5 19a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2H5Z"></path>
                        </svg>
                      </button>
                    </div>

                    <div className="image-info-dropdowns">
                      <ImageInfoDropdown
                        title="Describe"
                        copyContent={(() => {
                        
                          let describeText = "No description available";

                          // Method 1: Get from currentSessionId
                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            console.log(
                              "🔍 Found session by currentSessionId:",
                              session ? "YES" : "NO"
                            );
                            if (session) {
                              if (session.describe) {
                                describeText = session.describe;
                              }
                            }
                          }

                          // Method 2: Get from current image's session
                          if (
                            describeText === "No description available" &&
                            currentViewImageIndex !== null
                          ) {
                            const currentImage =
                              selectedImages[currentViewImageIndex];
                            console.log(
                              "🔍 Current image:",
                              currentImage ? "EXISTS" : "NULL"
                            );
                            if (currentImage) {
                              console.log(
                                "🔍 Current image sessionId:",
                                currentImage.sessionId
                              );
                              if (currentImage.sessionId) {
                                const session = selectedSessions.find(
                                  (s) => s.sessionId === currentImage.sessionId
                                );
                                console.log(
                                  "🔍 Found session by image sessionId:",
                                  session ? "YES" : "NO"
                                );
                                if (session) {
                                  console.log(
                                    "🔍 Session describe value:",
                                    session.describe
                                  );
                                  if (session.describe) {
                                    describeText = session.describe;
                                    console.log(
                                      "✅ Found describe from currentImage session:",
                                      describeText
                                    );
                                  }
                                }
                              }
                            }
                          }

                          // Method 3: Brute force - check all sessions
                          if (describeText === "No description available") {
                            console.log(
                              "🔍 Brute force checking all sessions..."
                            );
                            selectedSessions.forEach((session, index) => {
                              console.log(`🔍 Session ${index}:`, {
                                sessionId: session.sessionId,
                                describe: session.describe,
                                hasDescribe: !!session.describe,
                              });
                            });

                            // Try to get from any session that has describe
                            const sessionWithDescribe = selectedSessions.find(
                              (s) => s.describe
                            );
                            if (sessionWithDescribe) {
                              describeText = sessionWithDescribe.describe;
                              console.log(
                                "✅ Found describe from any session:",
                                describeText
                              );
                            }
                          }

                          console.log(
                            "🔖 Final describe for copy:",
                            describeText
                          );
                          return describeText;
                        })()}
                      >
                        {(() => {
                          // FIX: Enhanced debug and logic to get describe for display
                          console.log(
                            "🔍 DEBUG Describe - Getting display content"
                          );

                          let describeText = "No description available";

                          // Method 1: Get from currentSessionId
                          if (currentSessionId) {
                            const session = selectedSessions.find(
                              (s) => s.sessionId === currentSessionId
                            );
                            if (session && session.describe) {
                              describeText = session.describe;
                              console.log(
                                "✅ Display describe from currentSessionId:",
                                describeText
                              );
                            }
                          }

                          // Method 2: Get from current image's session
                          if (
                            describeText === "No description available" &&
                            currentViewImageIndex !== null
                          ) {
                            const currentImage =
                              selectedImages[currentViewImageIndex];
                            if (currentImage && currentImage.sessionId) {
                              const session = selectedSessions.find(
                                (s) => s.sessionId === currentImage.sessionId
                              );
                              if (session && session.describe) {
                                describeText = session.describe;
                                console.log(
                                  "✅ Display describe from currentImage session:",
                                  describeText
                                );
                              }
                            }
                          }

                          // Method 3: Brute force - get from any session that has describe
                          if (describeText === "No description available") {
                            const sessionWithDescribe = selectedSessions.find(
                              (s) => s.describe
                            );
                            if (sessionWithDescribe) {
                              describeText = sessionWithDescribe.describe;
                              console.log(
                                "✅ Display describe from any session:",
                                describeText
                              );
                            }
                          }

                          return (
                            <p className="prompt-text describe-box">
                              {describeText}
                            </p>
                          );
                        })()}
                      </ImageInfoDropdown>

                      <ImageInfoDropdown
                        title="Image Prompt"
                        isOpen={true}
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
                              className="prompt-text html-content main-prompt"
                              dangerouslySetInnerHTML={{
                                __html: formatPrompt(currentImagePrompt) 
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
