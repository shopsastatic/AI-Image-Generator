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

    useEffect(() => {
        if (isVisible) {
            loadUploadedFiles();
        }
    }, [isVisible]);

    useEffect(() => {
        applyFiltersAndSort(uploadedFiles, searchTerm, sortBy, sortOrder);
    }, [uploadedFiles, searchTerm, sortBy, sortOrder]);

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
        try {
            const files = await storageManager.getAllUploadedFiles();
            setUploadedFiles(files);
            applyFiltersAndSort(files, searchTerm, sortBy, sortOrder);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const applyFiltersAndSort = (
        files: UploadedFile[],
        search: string,
        sortField: "name" | "date" | "size" | "usage",
        order: "asc" | "desc"
    ) => {
        let filtered = files;

        if (search.trim()) {
            filtered = files.filter((file) =>
                file.fileName.toLowerCase().includes(search.toLowerCase())
            );
        }

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

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        applyFiltersAndSort(uploadedFiles, value, sortBy, sortOrder);
    };

    const handleSortChange = (field: "name" | "date" | "size" | "usage") => {
        const newOrder =
            field === sortBy && sortOrder === "desc" ? "asc" : "desc";
        setSortBy(field);
        setSortOrder(newOrder);
        applyFiltersAndSort(uploadedFiles, searchTerm, field, newOrder);
    };

    const handleFileClick = async (file: UploadedFile) => {
        setSelectedFileId(file.id);

        try {
            await storageManager.updateFileUsage(file.id);
        } catch (error) {
            console.error("❌ Error updating file usage:", error);
        }

        onFileSelect(file);
    };

    const handleDeleteFile = async (
        fileId: string,
        event: React.MouseEvent
    ) => {
        event.stopPropagation();

        const fileToDelete = uploadedFiles.find((f) => f.id === fileId);
        const fileName = fileToDelete?.fileName || "file này";

        if (window.confirm(`Bạn có chắc chắn muốn xóa "${fileName}"?`)) {
            setDeletingFileIds((prev) => new Set(prev).add(fileId));

            try {
                await storageManager.deleteUploadedFile(fileId);
                console.log("✅ Successfully deleted from storage");

                const updatedFiles = uploadedFiles.filter(
                    (f) => f.id !== fileId
                );
                setUploadedFiles(updatedFiles);

                if (selectedFileId === fileId) {
                    setSelectedFileId(null);
                }

                const notification = document.createElement("div");
                notification.textContent = `🗑️ Đã xóa "${fileName}"`;
                notification.className = "copy-notification";
                document.body.appendChild(notification);
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 2000);
            } catch (error) {
                let errorMessage = "Lỗi khi xóa file. Vui lòng thử lại.";
                if (error instanceof Error) {
                    errorMessage = `Lỗi: ${error.message}`;
                }

                alert(errorMessage);
                loadUploadedFiles();
            } finally {
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

    if (!isVisible) return null;

    return (
        <div className="uploaded-files-panel">
            <div className="uploaded-files-overlay" onClick={onClose} />
            <div className="uploaded-files-content" ref={panelRef}>
                <div className="uploaded-files-header">
                    <h3>📁 File đã upload</h3>
                    <div className="header-actions">
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
