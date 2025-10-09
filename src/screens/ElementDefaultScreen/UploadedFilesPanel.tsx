import React, { useEffect, useRef, useState } from "react";
import { UploadedFile, storageManager } from "./storageUtils";

interface UploadedFilesPanelProps {
    isVisible: boolean;
    onFileSelect: (file: UploadedFile) => void;
    onClose: () => void;
}

const UploadedFilesPanel: React.FC<UploadedFilesPanelProps> = ({
    isVisible,
    onFileSelect,
    onClose,
}) => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<UploadedFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [deletingFileIds, setDeletingFileIds] = useState<Set<string>>(
        new Set()
    );
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "date" | "size" | "usage">(
        "date"
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const panelRef = useRef<HTMLDivElement>(null);

    // Load uploaded files khi component mount hoặc visibility thay đổi
    useEffect(() => {
        if (isVisible) {
            loadUploadedFiles();
        }
    }, [isVisible]);

    // Cập nhật filtered files khi uploadedFiles thay đổi
    useEffect(() => {
        applyFiltersAndSort(uploadedFiles, searchTerm, sortBy, sortOrder);
    }, [uploadedFiles, searchTerm, sortBy, sortOrder]);

    // Handle click outside để đóng panel
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isVisible) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isVisible, onClose]);

    const loadUploadedFiles = async () => {
        setLoading(true);
        console.log("🔍 Loading uploaded files...");
        try {
            const files = await storageManager.getAllUploadedFiles();
            console.log("🔍 Loaded files:", files.length, files);
            setUploadedFiles(files);
            applyFiltersAndSort(files, searchTerm, sortBy, sortOrder);
        } catch (error) {
            console.error("❌ Error loading uploaded files:", error);
        } finally {
            setLoading(false);
        }
    };

    // Function để apply filters và sort
    const applyFiltersAndSort = (
        files: UploadedFile[],
        search: string,
        sortField: "name" | "date" | "size" | "usage",
        order: "asc" | "desc"
    ) => {
        let filtered = files;

        // Apply search filter
        if (search.trim()) {
            filtered = files.filter((file) =>
                file.fileName.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let compareValue = 0;

            switch (sortField) {
                case "name":
                    compareValue = a.fileName.localeCompare(b.fileName);
                    break;
                case "date":
                    compareValue =
                        new Date(a.timestamp).getTime() -
                        new Date(b.timestamp).getTime();
                    break;
                case "size":
                    compareValue = a.fileSize - b.fileSize;
                    break;
                case "usage":
                    compareValue = (a.usageCount || 0) - (b.usageCount || 0);
                    break;
            }

            return order === "asc" ? compareValue : -compareValue;
        });

        setFilteredFiles(filtered);
    };

    // Handle search change
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        applyFiltersAndSort(uploadedFiles, value, sortBy, sortOrder);
    };

    // Handle sort change
    const handleSortChange = (field: "name" | "date" | "size" | "usage") => {
        const newOrder =
            field === sortBy && sortOrder === "desc" ? "asc" : "desc";
        setSortBy(field);
        setSortOrder(newOrder);
        applyFiltersAndSort(uploadedFiles, searchTerm, field, newOrder);
    };

    const handleFileClick = async (file: UploadedFile) => {
        setSelectedFileId(file.id);

        // Cập nhật usage count
        try {
            await storageManager.updateFileUsage(file.id);
        } catch (error) {
            console.error("❌ Error updating file usage:", error);
        }

        // Gọi callback để select file
        onFileSelect(file);
    };

    const handleDeleteFile = async (
        fileId: string,
        event: React.MouseEvent
    ) => {
        event.stopPropagation();

        // Tìm file để hiển thị tên trong confirm dialog
        const fileToDelete = uploadedFiles.find((f) => f.id === fileId);
        const fileName = fileToDelete?.fileName || "file này";

        if (window.confirm(`Bạn có chắc chắn muốn xóa "${fileName}"?`)) {
            // Thêm file vào danh sách đang xóa
            setDeletingFileIds((prev) => new Set(prev).add(fileId));

            try {
                console.log("🔍 Attempting to delete file:", fileId, fileName);

                // Xóa từ storage
                await storageManager.deleteUploadedFile(fileId);
                console.log("✅ Successfully deleted from storage");

                // Cập nhật state
                const updatedFiles = uploadedFiles.filter(
                    (f) => f.id !== fileId
                );
                setUploadedFiles(updatedFiles);

                // Clear selection nếu file đang được chọn
                if (selectedFileId === fileId) {
                    setSelectedFileId(null);
                }

                // Hiển thị thông báo thành công
                const notification = document.createElement("div");
                notification.textContent = `🗑️ Đã xóa "${fileName}"`;
                notification.className = "copy-notification";
                document.body.appendChild(notification);
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 2000);

                console.log("✅ File deleted successfully");
            } catch (error) {
                console.error("❌ Error deleting file:", error);

                // Hiển thị error message chi tiết hơn
                let errorMessage = "Lỗi khi xóa file. Vui lòng thử lại.";
                if (error instanceof Error) {
                    errorMessage = `Lỗi: ${error.message}`;
                }

                alert(errorMessage);

                // Reload files để đảm bảo UI sync với storage
                loadUploadedFiles();
            } finally {
                // Remove file khỏi danh sách đang xóa
                setDeletingFileIds((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(fileId);
                    return newSet;
                });
            }
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // ✅ THÊM MỚI: Debug function để kiểm tra storage state
    const debugStorage = async () => {
        try {
            console.log("🔍 Debug Storage Info:");
            console.log("Current uploadedFiles state:", uploadedFiles);
            console.log("Current filteredFiles state:", filteredFiles);

            // Kiểm tra database health
            const health = await storageManager.checkDatabaseHealth();
            console.log("Database health:", health);

            const storageFiles = await storageManager.getAllUploadedFiles();
            console.log("Files from storage:", storageFiles);

            // Kiểm tra localStorage
            const localStorageData = localStorage.getItem("uploaded_files");
            if (localStorageData) {
                const parsed = JSON.parse(localStorageData);
                console.log("localStorage data:", parsed);
                console.log(
                    "localStorage file count:",
                    Object.keys(parsed).length
                );
            } else {
                console.log("No localStorage data found");
            }

            // Hiển thị notification với health info
            alert(
                `Debug info logged to console:\n- State files: ${uploadedFiles.length}\n- Storage files: ${storageFiles.length}\n- Storage method: ${health.storageMethod}\n- IndexedDB available: ${health.indexedDBAvailable}\n- Can perform operations: ${health.canPerformOperations}\n\nCheck browser console for details`
            );
        } catch (error) {
            console.error("❌ Debug error:", error);
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            alert(`Debug error: ${errorMessage}`);
        }
    };

    // ✅ THÊM MỚI: Cleanup function để đồng bộ storage
    const cleanupStorage = async () => {
        try {
            console.log("🧹 Cleaning up storage...");

            // Kiểm tra health trước
            const health = await storageManager.checkDatabaseHealth();
            console.log("Storage health before cleanup:", health);

            // Nếu có vấn đề với IndexedDB, thử reinitialize
            if (health.indexedDBAvailable && !health.canPerformOperations) {
                console.log("🔄 Attempting to reinitialize database...");
                await storageManager.reinitializeDatabase();
            }

            // Reload files để đảm bảo sync
            await loadUploadedFiles();

            console.log("✅ Storage cleanup completed");

            // Hiển thị notification
            const notification = document.createElement("div");
            notification.textContent = "🔄 Đã làm mới dữ liệu storage";
            notification.className = "copy-notification";
            document.body.appendChild(notification);
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 2000);
        } catch (error) {
            console.error("❌ Cleanup error:", error);
            alert(
                `Cleanup error: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    };

    if (!isVisible) return null;

    return (
        <div className="uploaded-files-panel">
            <div className="uploaded-files-overlay" onClick={onClose} />
            <div className="uploaded-files-content" ref={panelRef}>
                <div className="uploaded-files-header">
                    <h3>📁 File đã upload</h3>
                    <div className="header-actions">
                        <button
                            className="debug-btn"
                            onClick={debugStorage}
                            title="Debug Storage (kiểm tra console)"
                        >
                            🐛
                        </button>
                        <button
                            className="debug-btn"
                            onClick={cleanupStorage}
                            title="Làm mới dữ liệu"
                        >
                            🔄
                        </button>
                        <button className="close-btn" onClick={onClose}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Search và Sort Controls */}
                <div className="upload-controls">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="🔍 Tìm kiếm file..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="sort-container">
                        <label className="sort-label">Sắp xếp:</label>
                        <div className="sort-buttons">
                            <button
                                className={`sort-btn ${
                                    sortBy === "name" ? "active" : ""
                                }`}
                                onClick={() => handleSortChange("name")}
                                title="Sắp xếp theo tên"
                            >
                                Tên{" "}
                                {sortBy === "name" &&
                                    (sortOrder === "asc" ? "↑" : "↓")}
                            </button>
                            <button
                                className={`sort-btn ${
                                    sortBy === "date" ? "active" : ""
                                }`}
                                onClick={() => handleSortChange("date")}
                                title="Sắp xếp theo ngày"
                            >
                                Ngày{" "}
                                {sortBy === "date" &&
                                    (sortOrder === "asc" ? "↑" : "↓")}
                            </button>
                            <button
                                className={`sort-btn ${
                                    sortBy === "size" ? "active" : ""
                                }`}
                                onClick={() => handleSortChange("size")}
                                title="Sắp xếp theo kích thước"
                            >
                                Kích thước{" "}
                                {sortBy === "size" &&
                                    (sortOrder === "asc" ? "↑" : "↓")}
                            </button>
                            <button
                                className={`sort-btn ${
                                    sortBy === "usage" ? "active" : ""
                                }`}
                                onClick={() => handleSortChange("usage")}
                                title="Sắp xếp theo lần sử dụng"
                            >
                                Sử dụng{" "}
                                {sortBy === "usage" &&
                                    (sortOrder === "asc" ? "↑" : "↓")}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="uploaded-files-body">
                    {loading ? (
                        <div className="loading">Đang tải...</div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="empty-state">
                            {searchTerm ? (
                                <>
                                    <p>
                                        Không tìm thấy file nào phù hợp với "
                                        {searchTerm}"
                                    </p>
                                    <small>Thử tìm kiếm với từ khóa khác</small>
                                </>
                            ) : (
                                <>
                                    <p>Chưa có file nào được upload</p>
                                    <small>
                                        Upload ảnh để sử dụng lại trong các lần
                                        sau
                                    </small>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="files-count">
                                {filteredFiles.length} / {uploadedFiles.length}{" "}
                                file{filteredFiles.length !== 1 ? "s" : ""}
                                {searchTerm && ` phù hợp với "${searchTerm}"`}
                            </div>
                            <div className="files-list">
                                {filteredFiles.map((file) => (
                                    <div
                                        key={file.id}
                                        className={`file-item ${
                                            selectedFileId === file.id
                                                ? "selected"
                                                : ""
                                        } ${
                                            deletingFileIds.has(file.id)
                                                ? "deleting"
                                                : ""
                                        }`}
                                        onClick={() => handleFileClick(file)}
                                    >
                                        <div className="file-preview">
                                            <img
                                                src={file.imageBase64}
                                                alt={file.fileName}
                                            />
                                            {deletingFileIds.has(file.id) && (
                                                <div className="file-deleting-overlay">
                                                    <div className="deleting-spinner">
                                                        ⏳
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="file-info">
                                            <div
                                                className="file-name"
                                                title={file.fileName}
                                            >
                                                {file.fileName}
                                            </div>
                                            <div className="file-meta">
                                                <span className="file-size">
                                                    {formatFileSize(
                                                        file.fileSize
                                                    )}
                                                </span>
                                                <span className="file-date">
                                                    {formatDate(file.timestamp)}
                                                </span>
                                            </div>
                                            {file.usageCount > 0 && (
                                                <div className="usage-count">
                                                    Đã dùng: {file.usageCount}{" "}
                                                    lần
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className="delete-btn"
                                            onClick={(e) =>
                                                handleDeleteFile(file.id, e)
                                            }
                                            disabled={deletingFileIds.has(
                                                file.id
                                            )}
                                            title={
                                                deletingFileIds.has(file.id)
                                                    ? "Đang xóa..."
                                                    : "Xóa file"
                                            }
                                        >
                                            {deletingFileIds.has(file.id)
                                                ? "⏳"
                                                : "🗑️"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadedFilesPanel;
