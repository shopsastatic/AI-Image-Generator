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
  progress?: number;
}

const MAX_SESSIONS = 10;
const STORAGE_KEY = "enhance_sessions";

export const EnhanceScreen: React.FC = () => {
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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

      const data = await response.json();
      
      // Parse N8N response format
      let enhancedUrls: string[] = [];
      
      if (Array.isArray(data)) {
        // Format: [{ code: 0, message: "success", data: { generateUrl: "..." } }, ...]
        enhancedUrls = data
          .filter(item => item.code === 0 && item.data && item.data.generateUrl)
          .map(item => item.data.generateUrl);
      } else if (data.enhancedImages) {
        // Fallback format: { enhancedImages: [...] }
        enhancedUrls = data.enhancedImages;
      } else if (data.images) {
        // Fallback format: { images: [...] }
        enhancedUrls = data.images;
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

  const handleDownloadSession = async (session: ImageSession) => {
    if (!session.isEnhanced || !session.enhancedUrls) return;

    try {
      for (let i = 0; i < session.enhancedUrls.length; i++) {
        const url = session.enhancedUrls[i];
        const link = document.createElement("a");
        link.href = url;
        link.download = `enhanced-${session.id}-${i + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      showNotification("success", "Download Started", `Downloading ${session.enhancedUrls.length} images...`);
    } catch (error) {
      console.error("Download error:", error);
      showNotification("error", "Download Failed", "Failed to download images.");
    }
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
          <aside className="aside">
            <div className="aside-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
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
                    <h3 className="sessions-title">Upload Sessions</h3>
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

                          {/* Enhance/Download Button */}
                          {!session.isEnhancing && !session.isEnhanced && (
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
                          )}

                          {session.isEnhanced && (
                            <button
                              className="session-download-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSession(session);
                              }}
                              title="Download all images"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </button>
                          )}

                          <div className="session-stack">
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
                                <svg className="session-loading-spinner" viewBox="0 0 50 50">
                                  <circle
                                    className="session-loading-circle-bg"
                                    cx="25"
                                    cy="25"
                                    r="20"
                                  />
                                  <circle
                                    className="session-loading-circle"
                                    cx="25"
                                    cy="25"
                                    r="20"
                                    style={{
                                      strokeDashoffset: 125.6 - (125.6 * (session.progress || 0)) / 100,
                                    }}
                                  />
                                </svg>
                                <span className="session-loading-text">
                                  {session.progress || 0}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="session-info">
                            <span className="session-count">
                              {session.images.length} photos
                              {session.isEnhanced && " ✓"}
                            </span>
                            <span className="session-time">
                              {new Date(session.uploadedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
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