import React, { useState, useRef, useEffect } from "react";
import "./enhance.css";

interface UploadedImage {
  file: File;
  url: string;
  id: string;
}

interface ImageSession {
  id: string;
  images: UploadedImage[];
  uploadedAt: number;
  isEnhancing?: boolean;
  isEnhanced?: boolean;
  enhancedUrls?: string[];
  resizedUrls?: string[];
  progress?: number;
}

const MAX_SESSIONS = 10;
const STORAGE_KEY = "enhance_sessions";

// Generate random filename: e91193-c522-d817-fba8-10b3cf
const generateRandomFilename = (): string => {
  const segment = () => {
    return Array.from({ length: 4 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  };
  return `${segment()}${segment().slice(0, 2)}-${segment()}-${segment()}-${segment()}-${segment()}${segment().slice(0, 2)}`;
};

// Format time display
const formatSessionTime = (timestamp: number): string => {
  const now = new Date();
  const sessionDate = new Date(timestamp);
  
  // Check if same day
  const isSameDay = 
    now.getDate() === sessionDate.getDate() &&
    now.getMonth() === sessionDate.getMonth() &&
    now.getFullYear() === sessionDate.getFullYear();
  
  if (isSameDay) {
    // Return 24h format HH:mm
    return sessionDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } else {
    // Calculate days ago
    const diffTime = now.getTime() - sessionDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '1 day ago';
    } else {
      return `${diffDays} days ago`;
    }
  }
};

export const EnhanceScreen: React.FC = () => {
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingSession, setDownloadingSession] = useState<{id: string, type: 'original' | 'resized'} | null>(null);
  const [resizingSession, setResizingSession] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ImageSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const storedSessions: ImageSession[] = JSON.parse(stored);
          // Only load enhanced sessions (with real URLs)
          const validSessions = storedSessions.filter(s => s.isEnhanced && s.enhancedUrls);
          // Sort by uploadedAt descending (newest first)
          validSessions.sort((a, b) => b.uploadedAt - a.uploadedAt);
          setSessions(validSessions);
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      }
    };
    loadSessions();
  }, []);

  // Save sessions to localStorage
  const saveSessions = (sessionsToSave: ImageSession[]) => {
    try {
      // Only save enhanced sessions
      const sessionsToStore = sessionsToSave
        .filter(s => s.isEnhanced && s.enhancedUrls)
        .slice(0, MAX_SESSIONS) // Keep only MAX_SESSIONS
        .map(s => ({
          id: s.id,
          images: s.images.map(img => ({
            file: { name: img.file.name } as File,
            url: img.url,
            id: img.id,
          })),
          uploadedAt: s.uploadedAt,
          isEnhanced: s.isEnhanced,
          enhancedUrls: s.enhancedUrls,
          resizedUrls: s.resizedUrls,
        }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToStore));
    } catch (error) {
      console.error("Failed to save sessions:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length > 50) {
      alert("Maximum 50 photos allowed per session");
      return;
    }

    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length > 50) {
      alert("Maximum 50 photos allowed per session");
      return;
    }

    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;

    const newImages: UploadedImage[] = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      id: `${Date.now()}-${Math.random()}`,
    }));

    const newSession: ImageSession = {
      id: `session-${Date.now()}`,
      images: newImages,
      uploadedAt: Date.now(),
      isEnhancing: false,
      isEnhanced: false,
      progress: 0,
    };

    setSessions((prev) => {
      // Add new session at the beginning
      let updated = [newSession, ...prev];
      
      // If exceeds MAX_SESSIONS, remove the oldest (last) one
      if (updated.length > MAX_SESSIONS) {
        updated = updated.slice(0, MAX_SESSIONS);
        showNotification(
          "warning",
          "Session Limit Reached",
          `Only the latest ${MAX_SESSIONS} sessions are kept. The oldest session has been removed.`
        );
      }
      
      return updated;
    });
  };

  const handleSelectPhotos = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      saveSessions(updated);
      return updated;
    });
  };

  const handleRemoveImageFromSession = (sessionId: string, imageId: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === sessionId) {
          const filteredImages = s.images.filter(img => img.id !== imageId);
          
          // If no images left, return null to filter out
          if (filteredImages.length === 0) {
            return null;
          }
          
          return {
            ...s,
            images: filteredImages,
          };
        }
        return s;
      }).filter(Boolean) as ImageSession[];
      
      return updated;
    });
    
    // Update selected session if it's open
    setSelectedSession(prev => {
      if (prev && prev.id === sessionId) {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          const filteredImages = session.images.filter(img => img.id !== imageId);
          if (filteredImages.length === 0) {
            return null; // Close popup if no images left
          }
          return { ...session, images: filteredImages };
        }
      }
      return prev;
    });
  };

  const handleDownloadSingleImage = async (session: ImageSession, imageIndex: number, type: 'original' | 'resized' = 'original') => {
    if (!session.isEnhanced || !session.enhancedUrls) return;

    try {
      const randomName = generateRandomFilename();
      const extension = type === 'resized' ? 'png' : 'webp';
      const filename = `${randomName}.${extension}`;
      
      let blobUrl: string | null = null;
      
      if (type === 'resized') {
        // Check if we have cached resized URL
        if (session.resizedUrls && session.resizedUrls[imageIndex]) {
          console.log('✅ Using cached resized URL');
          const response = await fetch(session.resizedUrls[imageIndex]);
          if (!response.ok) {
            throw new Error(`Failed to fetch cached image: ${response.status}`);
          }
          
          const blob = await response.blob();
          blobUrl = URL.createObjectURL(blob);
        } else {
          // Need to resize via API and upload to get permanent URL
          const url = session.enhancedUrls[imageIndex];
          const response = await fetch('/api/convert-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: url }),
          });
          
          if (!response.ok) {
            throw new Error(`TinyPNG API error: ${response.status}`);
          }
          
          const blob = await response.blob();
          
          // Upload resized image to Magic API to get permanent URL
          const formData = new FormData();
          formData.append("filename", blob, `resized-${session.id}-${imageIndex}.png`);
          
          const uploadResponse = await fetch(
            "https://prod.api.market/api/v1/magicapi/image-upload/upload",
            {
              method: "POST",
              headers: {
                "x-magicapi-key": "cmfxojr010001jo04ld19izzv",
              },
              body: formData,
            }
          );
          
          if (!uploadResponse.ok) {
            console.error('Failed to upload resized image, using temporary URL');
            blobUrl = URL.createObjectURL(blob);
          } else {
            const uploadData = await uploadResponse.json();
            const permanentUrl = uploadData.url;
            
            // Save the permanent URL to localStorage
            setSessions((prev) => {
              const updated = prev.map((s) => {
                if (s.id === session.id) {
                  const newResizedUrls = [...(s.resizedUrls || Array(s.enhancedUrls?.length || 0).fill(null))];
                  newResizedUrls[imageIndex] = permanentUrl;
                  return { ...s, resizedUrls: newResizedUrls };
                }
                return s;
              });
              saveSessions(updated);
              return updated;
            });
            
            // Use permanent URL for download
            const finalResponse = await fetch(permanentUrl);
            const finalBlob = await finalResponse.blob();
            blobUrl = URL.createObjectURL(finalBlob);
            
            console.log('✅ Resized, uploaded and cached image URL');
          }
        }
      } else {
        // Original enhanced image
        const url = session.enhancedUrls[imageIndex];
        const proxyUrl = `/api/proxy-image-direct?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
      }
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      }, 100);
      
      showNotification("success", "Downloaded", `Image downloaded successfully!`);
    } catch (error) {
      console.error("Download error:", error);
      showNotification("error", "Download Failed", "Failed to download image.");
    }
  };

  const handleSessionClick = (session: ImageSession) => {
    setSelectedSession(session);
  };

  const handleClosePopup = () => {
    setSelectedSession(null);
  };

  const handleEnhanceAndResize = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.isEnhancing || session.isEnhanced) return;

    // Mark as enhancing
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, isEnhancing: true, progress: 0 } : s
      )
    );

    try {
      // Step 1: Upload images to Magic API
      console.log(`📤 Uploading ${session.images.length} images to Magic API...`);
      
      const uploadPromises = session.images.map(async (image, index) => {
        try {
          const blob = await fetch(image.url).then((r) => r.blob());
          const formData = new FormData();
          formData.append("filename", blob, `${session.id}-${index}.png`);
          
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
            console.error(`❌ Upload failed for image ${index}:`, errorText);
            return null;
          }
          
          const data = await response.json();
          return data.url;
        } catch (error) {
          console.error(`❌ Upload error for image ${index}:`, error);
          return null;
        }
      });

      const uploadedImageUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedImageUrls.filter((url) => url !== null) as string[];

      if (validUrls.length === 0) {
        throw new Error("All image uploads failed");
      }

      console.log(`✅ Uploaded ${validUrls.length} images successfully`);

      // Step 2: Update session with Magic API URLs and save to localStorage
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                images: s.images.map((img, idx) => ({
                  ...img,
                  url: validUrls[idx] || img.url,
                })),
              }
            : s
        );
        saveSessions(updated);
        return updated;
      });

      // Step 3: Simulate progress animation (just show loading, no percentage)
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min((elapsed / 60000) * 100, 99);
        
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId && s.isEnhancing
              ? { ...s, progress: Math.floor(progressPercent) }
              : s
          )
        );
      }, 300);

      // Step 4: Call N8N API
      const response = await fetch(
        "https://n8n.misencorp.com/webhook/enhance-multiple-image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            images: validUrls,
            sessionId: sessionId,
          }),
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const responseData = await response.json();
      
      // Parse N8N response format
      let enhancedUrls: string[] = [];
      
      if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].data) {
        const innerData = responseData[0].data;
        if (Array.isArray(innerData)) {
          enhancedUrls = innerData
            .filter(item => item.code === 0 && item.data && item.data.generateUrl)
            .map(item => item.data.generateUrl);
        }
      } else if (Array.isArray(responseData)) {
        enhancedUrls = responseData
          .filter(item => item.code === 0 && item.data && item.data.generateUrl)
          .map(item => item.data.generateUrl);
      } else if (responseData.enhancedImages) {
        enhancedUrls = responseData.enhancedImages;
      } else if (responseData.images) {
        enhancedUrls = responseData.images;
      }

      if (!Array.isArray(enhancedUrls) || enhancedUrls.length === 0) {
        throw new Error("No enhanced images returned from API");
      }

      console.log(`✅ Enhancement complete. Received ${enhancedUrls.length} enhanced URLs`);

      // Step 5: Update session with enhanced URLs (but keep isEnhancing = true for resize)
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                isEnhancing: true, // Keep loading during resize
                isEnhanced: true,
                enhancedUrls: enhancedUrls,
                progress: 100,
                images: s.images.map((img, idx) => ({
                  ...img,
                  url: enhancedUrls[idx] || img.url,
                })),
              }
            : s
        );
        saveSessions(updated);
        return updated;
      });

      // Step 6: Auto-resize all images in background
      console.log(`🔄 Starting auto-resize for ${enhancedUrls.length} images...`);
      const resizedUrlsToSave: (string | null)[] = Array(enhancedUrls.length).fill(null);
      
      for (let i = 0; i < enhancedUrls.length; i++) {
        try {
          const url = enhancedUrls[i];
          
          // Resize via API
          const resizeResponse = await fetch('/api/convert-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: url }),
          });
          
          if (!resizeResponse.ok) {
            console.error(`Failed to resize image ${i + 1}`);
            continue;
          }
          
          const blob = await resizeResponse.blob();
          
          // Upload resized image to Magic API to get permanent URL
          const formData = new FormData();
          formData.append("filename", blob, `resized-${sessionId}-${i}.png`);
          
          const uploadResponse = await fetch(
            "https://prod.api.market/api/v1/magicapi/image-upload/upload",
            {
              method: "POST",
              headers: {
                "x-magicapi-key": "cmfxojr010001jo04ld19izzv",
              },
              body: formData,
            }
          );
          
          if (!uploadResponse.ok) {
            console.error(`Failed to upload resized image ${i + 1}`);
            continue;
          }
          
          const uploadData = await uploadResponse.json();
          resizedUrlsToSave[i] = uploadData.url;
          
          console.log(`✅ Resized and uploaded image ${i + 1}/${enhancedUrls.length}`);
        } catch (error) {
          console.error(`❌ Error resizing image ${i + 1}:`, error);
        }
      }
      
      // Save resized URLs to localStorage and mark as complete
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? { ...s, resizedUrls: resizedUrlsToSave, isEnhancing: false }
            : s
        );
        saveSessions(updated);
        return updated;
      });
      
      const successCount = resizedUrlsToSave.filter(url => url !== null).length;
      console.log(`✅ Completed resizing. ${successCount}/${enhancedUrls.length} images resized successfully`);
      
      showNotification("success", "All Done!", `Enhanced and resized ${successCount} images!`);
    } catch (error) {
      console.error("Enhancement error:", error);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, isEnhancing: false, progress: 0 }
            : s
        )
      );
      showNotification("error", "Enhancement Failed", "Failed to enhance images. Please try again.");
    }
  };

  const handleEnhanceSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.isEnhancing || session.isEnhanced) return;

    // Mark as enhancing
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, isEnhancing: true, progress: 0 } : s
      )
    );

    try {
      // Step 1: Upload images to Magic API
      console.log(`📤 Uploading ${session.images.length} images to Magic API...`);
      
      const uploadPromises = session.images.map(async (image, index) => {
        try {
          const blob = await fetch(image.url).then((r) => r.blob());
          const formData = new FormData();
          formData.append("filename", blob, `${session.id}-${index}.png`);
          
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
            console.error(`❌ Upload failed for image ${index}:`, errorText);
            return null;
          }
          
          const data = await response.json();
          return data.url;
        } catch (error) {
          console.error(`❌ Upload error for image ${index}:`, error);
          return null;
        }
      });

      const uploadedImageUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedImageUrls.filter((url) => url !== null) as string[];

      if (validUrls.length === 0) {
        throw new Error("All image uploads failed");
      }

      console.log(`✅ Uploaded ${validUrls.length} images successfully`);

      // Step 2: Update session with Magic API URLs and save to localStorage
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                images: s.images.map((img, idx) => ({
                  ...img,
                  url: validUrls[idx] || img.url,
                })),
              }
            : s
        );
        // Save immediately with Magic API URLs
        saveSessions(updated);
        return updated;
      });

      // Step 3: Simulate progress for 60 seconds
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min((elapsed / 60000) * 100, 99);
        
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId && s.isEnhancing
              ? { ...s, progress: Math.floor(progressPercent) }
              : s
          )
        );
      }, 300);

      // Step 4: Call N8N API
      const response = await fetch(
        "https://n8n.misencorp.com/webhook/enhance-multiple-image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            images: validUrls,
            sessionId: sessionId,
          }),
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const responseData = await response.json();
      
      // Parse N8N response format
      let enhancedUrls: string[] = [];
      
      // Check if response is the new N8N format: [{ data: [...] }]
      if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].data) {
        // Extract the inner data array
        const innerData = responseData[0].data;
        if (Array.isArray(innerData)) {
          enhancedUrls = innerData
            .filter(item => item.code === 0 && item.data && item.data.generateUrl)
            .map(item => item.data.generateUrl);
        }
      } else if (Array.isArray(responseData)) {
        // Old format: [{ code: 0, message: "success", data: { generateUrl: "..." } }, ...]
        enhancedUrls = responseData
          .filter(item => item.code === 0 && item.data && item.data.generateUrl)
          .map(item => item.data.generateUrl);
      } else if (responseData.enhancedImages) {
        // Fallback format: { enhancedImages: [...] }
        enhancedUrls = responseData.enhancedImages;
      } else if (responseData.images) {
        // Fallback format: { images: [...] }
        enhancedUrls = responseData.images;
      }

      if (!Array.isArray(enhancedUrls) || enhancedUrls.length === 0) {
        throw new Error("No enhanced images returned from API");
      }

      console.log(`✅ Enhancement complete. Received ${enhancedUrls.length} enhanced URLs`);

      // Step 5: Update session with N8N enhanced URLs
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                isEnhancing: false,
                isEnhanced: true,
                enhancedUrls: enhancedUrls,
                progress: 100,
                images: s.images.map((img, idx) => ({
                  ...img,
                  url: enhancedUrls[idx] || img.url,
                })),
              }
            : s
        );
        saveSessions(updated);
        return updated;
      });

      showNotification("success", "Enhancement Complete", "All images have been enhanced successfully!");
    } catch (error) {
      console.error("Enhancement error:", error);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, isEnhancing: false, progress: 0 }
            : s
        )
      );
      showNotification("error", "Enhancement Failed", "Failed to enhance images. Please try again.");
    }
  };

  const handleDownloadSession = async (session: ImageSession, type: 'original' | 'resized' = 'original') => {
    if (!session.isEnhanced || !session.enhancedUrls) return;

    try {
      setDownloadingSession({ id: session.id, type });
      showNotification("success", "Download Started", `Processing ${session.enhancedUrls.length} images...`);
      
      // If resized and we already have resizedUrls, use them
      if (type === 'resized' && session.resizedUrls && session.resizedUrls.length === session.enhancedUrls.length) {
        const allUrlsValid = session.resizedUrls.every(url => url !== null);
        
        if (allUrlsValid) {
          console.log('✅ Using cached resized URLs from localStorage');
          
          for (let i = 0; i < session.resizedUrls.length; i++) {
            const url = session.resizedUrls[i];
            const randomName = generateRandomFilename();
            const filename = `${randomName}.png`;
            
            try {
              const response = await fetch(url);
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
              }
              
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              
              const link = document.createElement("a");
              link.href = blobUrl;
              link.download = filename;
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              
              setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
              }, 100);
              
              console.log(`✅ Downloaded cached image ${i + 1}/${session.resizedUrls.length}`);
            } catch (error) {
              console.error(`❌ Failed to download image ${i + 1}:`, error);
              showNotification("error", "Download Failed", `Failed to download image ${i + 1}.`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          showNotification("success", "Download Complete", `Downloaded ${session.resizedUrls.length} resized images!`);
          setDownloadingSession(null);
          return;
        }
      }
      
      const resizedUrlsToSave: (string | null)[] = Array(session.enhancedUrls.length).fill(null);
      
      for (let i = 0; i < session.enhancedUrls.length; i++) {
        const url = session.enhancedUrls[i];
        let blobUrl: string | null = null;
        const randomName = generateRandomFilename();
        const extension = type === 'resized' ? 'png' : 'webp';
        const filename = `${randomName}.${extension}`;
        
        try {
          if (type === 'resized') {
            // Check if this specific image already has cached URL
            if (session.resizedUrls && session.resizedUrls[i]) {
              console.log(`✅ Using cached URL for image ${i + 1}`);
              const response = await fetch(session.resizedUrls[i]);
              if (!response.ok) {
                throw new Error(`Failed to fetch cached image: ${response.status}`);
              }
              const blob = await response.blob();
              blobUrl = URL.createObjectURL(blob);
              resizedUrlsToSave[i] = session.resizedUrls[i];
            } else {
              // Resize via API
              const response = await fetch('/api/convert-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ imageUrl: url }),
              });
              
              if (!response.ok) {
                throw new Error(`TinyPNG API error: ${response.status}`);
              }
              
              const blob = await response.blob();
              
              // Upload resized image to Magic API to get permanent URL
              const formData = new FormData();
              formData.append("filename", blob, `resized-${session.id}-${i}.png`);
              
              const uploadResponse = await fetch(
                "https://prod.api.market/api/v1/magicapi/image-upload/upload",
                {
                  method: "POST",
                  headers: {
                    "x-magicapi-key": "cmfxojr010001jo04ld19izzv",
                  },
                  body: formData,
                }
              );
              
              if (!uploadResponse.ok) {
                console.error(`Failed to upload resized image ${i + 1}, using temporary URL`);
                blobUrl = URL.createObjectURL(blob);
              } else {
                const uploadData = await uploadResponse.json();
                const permanentUrl = uploadData.url;
                resizedUrlsToSave[i] = permanentUrl;
                
                // Download from permanent URL
                const finalResponse = await fetch(permanentUrl);
                const finalBlob = await finalResponse.blob();
                blobUrl = URL.createObjectURL(finalBlob);
                
                console.log(`✅ Resized and uploaded image ${i + 1}/${session.enhancedUrls.length}`);
              }
            }
          } else {
            const proxyUrl = `/api/proxy-image-direct?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status}`);
            }
            
            const blob = await response.blob();
            blobUrl = URL.createObjectURL(blob);
            
            console.log(`✅ Fetched original image ${i + 1}/${session.enhancedUrls.length}`);
          }
          
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          
          setTimeout(() => {
            document.body.removeChild(link);
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
            }
          }, 100);
          
        } catch (error) {
          console.error(`❌ Failed to download image ${i + 1}:`, error);
          showNotification("error", "Download Failed", `Failed to download image ${i + 1}.`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // If we downloaded resized images, save the permanent URLs to localStorage
      if (type === 'resized') {
        setSessions((prev) => {
          const updated = prev.map((s) => {
            if (s.id === session.id) {
              // Merge existing URLs with new ones
              const existingUrls = s.resizedUrls || [];
              const mergedUrls = resizedUrlsToSave.map((newUrl, idx) => 
                newUrl || existingUrls[idx] || null
              );
              return { ...s, resizedUrls: mergedUrls };
            }
            return s;
          });
          saveSessions(updated);
          return updated;
        });
        console.log('✅ Saved resized URLs to localStorage');
      }
      
      const typeText = type === 'resized' ? 'resized' : 'original';
      showNotification("success", "Download Complete", `Downloaded ${session.enhancedUrls.length} ${typeText} images!`);
    } catch (error) {
      console.error("Download error:", error);
      showNotification("error", "Download Failed", "Failed to download images.");
    } finally {
      setDownloadingSession(null);
    }
  };

  // Check if session has resized images
  const hasResizedImages = (session: ImageSession): boolean => {
    return !!(session.resizedUrls && session.resizedUrls.length > 0 && session.resizedUrls.some(url => url !== null));
  };

  const handleResizeSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || !session.isEnhanced || !session.enhancedUrls) return;

    setResizingSession(sessionId);
    showNotification("success", "Resizing Started", `Processing ${session.enhancedUrls.length} images...`);

    try {
      const resizedUrlsToSave: (string | null)[] = Array(session.enhancedUrls.length).fill(null);
      
      // Check if we have existing resized URLs
      if (session.resizedUrls && session.resizedUrls.length > 0) {
        session.resizedUrls.forEach((url, idx) => {
          if (url) resizedUrlsToSave[idx] = url;
        });
      }
      
      for (let i = 0; i < session.enhancedUrls.length; i++) {
        // Skip if already resized
        if (resizedUrlsToSave[i]) {
          console.log(`✅ Image ${i + 1} already resized, skipping...`);
          continue;
        }
        
        try {
          const url = session.enhancedUrls[i];
          
          // Resize via API
          const resizeResponse = await fetch('/api/convert-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl: url }),
          });
          
          if (!resizeResponse.ok) {
            console.error(`Failed to resize image ${i + 1}`);
            continue;
          }
          
          const blob = await resizeResponse.blob();
          
          // Upload resized image to Magic API to get permanent URL
          const formData = new FormData();
          formData.append("filename", blob, `resized-${sessionId}-${i}.png`);
          
          const uploadResponse = await fetch(
            "https://prod.api.market/api/v1/magicapi/image-upload/upload",
            {
              method: "POST",
              headers: {
                "x-magicapi-key": "cmfxojr010001jo04ld19izzv",
              },
              body: formData,
            }
          );
          
          if (!uploadResponse.ok) {
            console.error(`Failed to upload resized image ${i + 1}`);
            continue;
          }
          
          const uploadData = await uploadResponse.json();
          resizedUrlsToSave[i] = uploadData.url;
          
          console.log(`✅ Resized and uploaded image ${i + 1}/${session.enhancedUrls.length}`);
        } catch (error) {
          console.error(`❌ Error resizing image ${i + 1}:`, error);
        }
      }
      
      // Save resized URLs to localStorage
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? { ...s, resizedUrls: resizedUrlsToSave }
            : s
        );
        saveSessions(updated);
        return updated;
      });
      
      const successCount = resizedUrlsToSave.filter(url => url !== null).length;
      console.log(`✅ Completed resizing. ${successCount}/${session.enhancedUrls.length} images resized successfully`);
      
      showNotification("success", "Resize Complete", `Resized ${successCount} images successfully!`);
    } catch (error) {
      console.error("Resize error:", error);
      showNotification("error", "Resize Failed", "Failed to resize images. Please try again.");
    } finally {
      setResizingSession(null);
    }
  };

  const handleHomeClick = () => {
    window.location.href = '/';
  };

  return (
    <div className="element-default-screen enhance-screen">
      {/* Header */}
      <div className="main-header">
        <div className="header-content">
          <h1 className="header-title">Enhance Images</h1>
          <div className="header-info">
            <span className="session-counter">
              {sessions.length} / {MAX_SESSIONS} sessions
            </span>
          </div>
        </div>
      </div>

      <div className="main-2">
        <div className="overlap-2">
          {/* Sidebar */}
          <aside className="aside" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
            <div className="aside-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
          </aside>

          {/* Main Content */}
          <div className="container-wrapper">
            <div className="container-7">
              <div className="enhance-container">
                {/* Upload Area */}
                <div
                  className={`upload-area ${isDragging ? "dragging" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon">
                    <svg
                      width="80"
                      height="80"
                      viewBox="0 0 80 80"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="10"
                        y="20"
                        width="50"
                        height="45"
                        rx="4"
                        stroke="#9ca3af"
                        strokeWidth="2.5"
                        fill="none"
                      />
                      <rect
                        x="20"
                        y="15"
                        width="50"
                        height="45"
                        rx="4"
                        stroke="#6b7280"
                        strokeWidth="2.5"
                        fill="white"
                      />
                      <circle cx="30" cy="28" r="4" fill="#9ca3af" />
                      <path
                        d="M20 50 L35 35 L45 45 L55 35 L70 50 L70 60 L20 60 Z"
                        fill="#d1d5db"
                      />
                      <circle
                        cx="62"
                        cy="52"
                        r="12"
                        fill="white"
                        stroke="#6b7280"
                        strokeWidth="2"
                      />
                      <path
                        d="M62 46 L62 58 M56 52 L68 52"
                        stroke="#6b7280"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <h2 className="upload-title">
                    Drag to upload up to 50 photos
                  </h2>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />

                  <button className="select-photos-btn" onClick={handleSelectPhotos}>
                    Select photos
                  </button>
                </div>

                {/* Sessions List */}
                {sessions.length > 0 && (
                  <div className="sessions-container">
                    <h3 className="sessions-title">Media Library</h3>
                    <div className="sessions-list">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`session-card ${
                            session.isEnhancing ? "enhancing" : ""
                          } ${session.isEnhanced ? "enhanced" : ""}`}
                        >
                          <button
                            className="session-delete-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            title="Delete session"
                            disabled={session.isEnhancing}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              fill="currentColor"
                              viewBox="0 0 16 16"
                            >
                              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                            </svg>
                          </button>

                          {/* Enhance Button */}
                          {!session.isEnhancing && !session.isEnhanced && (
                            <>
                              <button
                                className="session-enhance-icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnhanceSession(session.id);
                                }}
                                title="Enhance images"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M15 4V2" />
                                  <path d="M15 16v-2" />
                                  <path d="M8 9h2" />
                                  <path d="M20 9h2" />
                                  <path d="M17.8 11.8 19 13" />
                                  <path d="M15 9h0" />
                                  <path d="M17.8 6.2 19 5" />
                                  <path d="m3 21 9-9" />
                                  <path d="M12.2 6.2 11 5" />
                                </svg>
                              </button>
                              <button
                                className="session-enhance-resize-icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnhanceAndResize(session.id);
                                }}
                                title="Enhance and resize images"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M15 3h6v6" />
                                  <path d="M9 21H3v-6" />
                                  <path d="M21 3l-7 7" />
                                  <path d="M3 21l7-7" />
                                  <circle cx="12" cy="12" r="2" />
                                </svg>
                              </button>
                            </>
                          )}

                          {/* Download Buttons */}
                          {session.isEnhanced && (
                            <>
                              <button
                                className="session-download-icon session-download-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadSession(session, 'original');
                                }}
                                title="Download enhanced images"
                                disabled={downloadingSession?.id === session.id}
                              >
                                {downloadingSession?.id === session.id && downloadingSession?.type === 'original' ? (
                                  <svg className="download-spinner" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" x2="12" y1="15" y2="3"/>
                                  </svg>
                                )}
                              </button>
                              <button
                                className={`session-download-icon session-download-right ${!hasResizedImages(session) ? 'not-resized' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasResizedImages(session)) {
                                    handleDownloadSession(session, 'resized');
                                  } else {
                                    handleResizeSession(session.id);
                                  }
                                }}
                                title={hasResizedImages(session) ? "Download resized images" : "Resize images"}
                                disabled={downloadingSession?.id === session.id || resizingSession === session.id}
                              >
                                {resizingSession === session.id ? (
                                  <svg className="download-spinner" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
                                  </svg>
                                ) : hasResizedImages(session) ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"/>
                                    <line x1="12" y1="8" x2="12" y2="16"/>
                                    <polyline points="9,13 12,16 15,13"/>
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"></circle><line x1="12" y1="8" x2="12" y2="16"></line><polyline points="9,13 12,16 15,13"></polyline></svg>
                                )}
                              </button>
                            </>
                          )}

                          <div 
                            className="session-stack"
                            onClick={() => handleSessionClick(session)}
                            style={{ cursor: 'pointer' }}
                          >
                            {session.images.slice(0, 5).map((img, index) => (
                              <div
                                key={img.id}
                                className="session-image-wrapper"
                                style={{
                                  transform: `rotate(${(index - 2) * 3}deg) translateY(${
                                    index * 2
                                  }px)`,
                                  zIndex: index,
                                }}
                              >
                                <img
                                  src={img.url}
                                  alt={img.file.name}
                                  className="session-image"
                                />
                              </div>
                            ))}

                            {/* Loading Overlay */}
                            {session.isEnhancing && (
                              <div className="session-loading-overlay">
                                <div className="session-loading-dots">
                                  <span></span>
                                  <span></span>
                                  <span></span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="session-info">
                            <span className="session-count">
                              {session.images.length} photos
                              {session.isEnhanced && " ✓"}
                            </span>
                            <span className="session-time">
                              {formatSessionTime(session.uploadedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Popup */}
      {selectedSession && (
        <div 
          className="popup-overlay"
          onClick={handleClosePopup}
        >
          <div 
            className="popup-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-header">
              <h3 className="popup-title">
                {selectedSession.images.length} photos
                {selectedSession.isEnhanced && " ✓"}
              </h3>
              <button 
                className="popup-close"
                onClick={handleClosePopup}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            </div>
            <div className="popup-images-grid">
              {selectedSession.images.map((img, index) => (
                <div key={img.id} className="popup-image-item">
                  {!selectedSession.isEnhanced && (
                    <button
                      className="popup-image-remove"
                      onClick={() => handleRemoveImageFromSession(selectedSession.id, img.id)}
                      title="Remove image"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                      </svg>
                    </button>
                  )}
                  
                  {selectedSession.isEnhanced && (
                    <div className="popup-image-download-buttons">
                      <button
                        className="popup-download-btn popup-download-original"
                        onClick={() => handleDownloadSingleImage(selectedSession, index, 'original')}
                        title="Download enhanced image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" x2="12" y1="15" y2="3"/>
                        </svg>
                      </button>
                      <button
                        className={`popup-download-btn popup-download-resized ${!hasResizedImages(selectedSession) ? 'not-resized' : ''}`}
                        onClick={() => {
                          if (hasResizedImages(selectedSession)) {
                            handleDownloadSingleImage(selectedSession, index, 'resized');
                          } else {
                            handleResizeSession(selectedSession.id);
                          }
                        }}
                        title={hasResizedImages(selectedSession) ? "Download resized image" : "Resize images first"}
                        disabled={resizingSession === selectedSession.id}
                      >
                        {resizingSession === selectedSession.id ? (
                          <svg className="download-spinner" viewBox="0 0 24 24" fill="none" style={{ width: '16px', height: '16px' }}>
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" />
                          </svg>
                        ) : hasResizedImages(selectedSession) ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"/>
                            <line x1="12" y1="8" x2="12" y2="16"/>
                            <polyline points="9,13 12,16 15,13"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"/>
                            <path d="M15 9l-6 6M9 9l6 6"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  
                  <img
                    src={img.url}
                    alt={img.file.name}
                    className="popup-image"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function showNotification(
  type: "success" | "error" | "warning",
  title: string,
  message: string
) {
  const colors = {
    error: { bg: "#ff6b6b", text: "white" },
    warning: { bg: "#f39c12", text: "white" },
    success: { bg: "#4CAF50", text: "white" },
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <strong>${title}</strong><br>
      ${message}
    </div>
  `;
  document.body.appendChild(notification);

  setTimeout(
    () => {
      if (notification.parentElement) {
        document.body.removeChild(notification);
      }
    },
    type === "error" ? 5000 : 3000
  );
}

export default EnhanceScreen;