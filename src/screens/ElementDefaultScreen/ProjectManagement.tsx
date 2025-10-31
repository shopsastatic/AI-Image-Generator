import React, { useState, useRef, useEffect, useCallback } from "react";
import DraggableSelect from "./DraggableSelect";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  Plus,
  Edit2,
  Save,
  Trash2,
  X,
  Search,
  Filter,
  Target,
  Share2,
  Globe,
  Clock,
  MoreHorizontal,
  Check,
  RefreshCw,
  Eye,
  Copy,
  Download,
  Upload,
  FileText,
  Zap,
  Brain,
  User,
  Settings,
  Tags,
  ChevronDown,
  ChevronRight,
  Users,
  BookOpen,
} from "lucide-react";

interface Role {
  name: string;
  subcategoryCount: number;
  users: number;
}

// ✅ TypeScript Interfaces
interface Project {
  filename: string;
  project: string;
  category: string;
  subcategory: string;
  instructionType: "user" | "system";
  targetModel: "universal" | "deepseek";
  status: "active" | "inactive" | "paused";
  createdAt: string;
  lastModified: string;
}

interface FormData {
  name: string;
  instructions: string;
  promptContent: string;
  category: string;
  subcategory: string;
  targetModel: string;
  instructionType: string;
  status: string;
}

interface CategoryOption {
  value: string;
  label: string;
  icon: any;
  color: string;
  description: string;
}

interface SubcategoryOption {
  id: string;
  value: string;
  label: string;
  category: string;
  status: "active" | "inactive";
  createdAt: string;
  lastModified: string;
}

interface NotificationProps {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  onClose: () => void;
}

interface SubcategoryFormData {
  value: string;
  label: string;
  category: string;
  status: string;
}

// ✅ Notification Component
const Notification: React.FC<NotificationProps> = ({
  type,
  title,
  message,
  onClose,
}) => {
  const colors = {
    success: {
      bg: "bg-green-50",
      text: "text-green-800",
      border: "border-green-200",
      icon: "✅",
    },
    error: {
      bg: "bg-red-50",
      text: "text-red-800",
      border: "border-red-200",
      icon: "❌",
    },
    warning: {
      bg: "bg-yellow-50",
      text: "text-yellow-800",
      border: "border-yellow-200",
      icon: "⚠️",
    },
    info: {
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
      icon: "ℹ️",
    },
  };

  const color = colors[type];

  useEffect(() => {
    const timeout = type === "warning" ? 10000 : 5000;
    const timer = setTimeout(() => {
      onClose();
    }, timeout);

    return () => clearTimeout(timer);
  }, [onClose, type]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md w-full ${color.bg} ${color.border} border rounded-lg shadow-lg p-4`}
    >
      <div className="flex items-start">
        <span className="text-lg mr-3 flex-shrink-0">{color.icon}</span>
        <div className="flex-1">
          <h3 className={`font-semibold ${color.text} text-sm mb-2`}>
            {title}
          </h3>
          <pre
            className={`${color.text} text-xs mt-1 opacity-90 whitespace-pre-wrap font-sans leading-relaxed`}
          >
            {message}
          </pre>
        </div>
        <button
          onClick={onClose}
          className={`${color.text} hover:opacity-70 ml-2 flex-shrink-0`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ✅ Sortable Row Component for Subcategories
interface SortableSubcategoryRowProps {
  subcategory: SubcategoryOption;
  parentCategories: CategoryOption[];
  onEdit: (sub: SubcategoryOption) => void;
  onDelete: (sub: SubcategoryOption) => void;
  onStatusToggle: (sub: SubcategoryOption) => void;
  onCopy: (value: string, label: string) => void;
  getParentCategoryData: (value: string) => CategoryOption | undefined;
  getStatusStyle: (status: string) => string;
  getTimeAgo: (date: string) => string;
}

const SortableSubcategoryRow: React.FC<SortableSubcategoryRowProps> = ({
  subcategory,
  parentCategories,
  onEdit,
  onDelete,
  onStatusToggle,
  onCopy,
  getParentCategoryData,
  getStatusStyle,
  getTimeAgo,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: subcategory.id,
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "#f3f4f6" : "white",
  };

  const parentCat = getParentCategoryData(subcategory.category);
  const ParentIcon = parentCat?.icon;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 transition-colors ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      {/* Drag Handle */}
      <td className="py-4 px-4 w-12">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      </td>

      {/* Subcategory Name */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
            <Tags className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {subcategory.label}
            </h3>
            <div className="text-xs text-gray-500 font-mono">
              {subcategory.value}
            </div>
          </div>
        </div>
      </td>

      {/* Parent Category */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${parentCat?.color}`}>
            {ParentIcon && <ParentIcon className="w-4 h-4" />}
          </div>
          <span className="text-sm font-medium text-gray-900">
            {parentCat?.label}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="py-4 px-6">
        <button
          onClick={() => onStatusToggle(subcategory)}
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(
            subcategory.status
          )} hover:opacity-80 transition-opacity`}
        >
          {subcategory.status.charAt(0).toUpperCase() +
            subcategory.status.slice(1)}
        </button>
      </td>

      {/* Updated */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-1 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{getTimeAgo(subcategory.lastModified)}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onCopy(subcategory.value, "Subcategory value")}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Copy value"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(subcategory)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit subcategory"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(subcategory)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete subcategory"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// Add new component before ProjectManagement component
interface SubcategoryRowProps {
  subcategory: SubcategoryOption;
  currentUser: { email: string; role: string; id?: string } | null;
  parentCategories: CategoryOption[];
  onEdit: (sub: SubcategoryOption) => void;
  onDelete: (sub: SubcategoryOption) => void;
  onStatusToggle: (sub: SubcategoryOption) => void;
  onCopy: (value: string, label: string) => void;
  getParentCategoryData: (value: string) => CategoryOption | undefined;
  getStatusStyle: (status: string) => string;
  getTimeAgo: (date: string) => string;
}

const SubcategoryRow: React.FC<SubcategoryRowProps> = ({
  subcategory,
  currentUser,
  parentCategories,
  onEdit,
  onDelete,
  onStatusToggle,
  onCopy,
  getParentCategoryData,
  getStatusStyle,
  getTimeAgo,
}) => {
  const isAdmin = currentUser?.role === "Admin";
  const isOwner = subcategory.createdBy?.userId === currentUser?.id;
  const canEdit = isAdmin || isOwner;
  const canDelete = isAdmin || isOwner;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: subcategory.id,
    disabled: !isAdmin, // ✅ Only admin can drag
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "#f3f4f6" : "white",
  };

  const parentCat = getParentCategoryData(subcategory.category);
  const ParentIcon = parentCat?.icon;

  // ✅ Get access type for display
  const getAccessType = () => {
    if (isOwner) return "Owner";
    if (subcategory.allowedRoles?.includes(currentUser?.role || ""))
      return "Assigned";
    if (isAdmin) return "Admin";
    return "No Access";
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 transition-colors ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      {/* ✅ Drag Handle - Only for Admin */}
      {isAdmin && (
        <td className="py-4 px-4 w-12">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className="w-5 h-5" />
          </div>
        </td>
      )}

      {/* Subcategory Name */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
            <Tags className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {subcategory.label}
            </h3>
            <div className="text-xs text-gray-500 font-mono">
              {subcategory.value}
            </div>
          </div>
        </div>
      </td>

      {/* Parent Category */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${parentCat?.color}`}>
            {ParentIcon && <ParentIcon className="w-4 h-4" />}
          </div>
          <span className="text-sm font-medium text-gray-900">
            {parentCat?.label}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="py-4 px-6">
        <button
          onClick={() => canEdit && onStatusToggle(subcategory)}
          disabled={!canEdit}
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(
            subcategory.status
          )} ${
            canEdit
              ? "hover:opacity-80 cursor-pointer"
              : "cursor-not-allowed opacity-60"
          } transition-opacity`}
        >
          {subcategory.status.charAt(0).toUpperCase() +
            subcategory.status.slice(1)}
        </button>
      </td>

      {/* ✅ Access Type - Only for non-admin */}
      {!isAdmin && (
        <td className="py-4 px-6">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isOwner
                ? "bg-purple-100 text-purple-700 border border-purple-200"
                : "bg-green-100 text-green-700 border border-green-200"
            }`}
          >
            {getAccessType()}
          </span>
        </td>
      )}

      {/* Updated */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-1 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>{getTimeAgo(subcategory.lastModified)}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-4 px-6">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onCopy(subcategory.value, "Subcategory value")}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Copy value"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* ✅ Edit - Only for Admin or Owner */}
          {canEdit && (
            <button
              onClick={() => onEdit(subcategory)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit subcategory"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {/* ✅ Delete - Only for Admin or Owner */}
          {canDelete && (
            <button
              onClick={() => onDelete(subcategory)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete subcategory"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* ✅ View only indicator */}
          {!canEdit && !canDelete && (
            <span className="text-xs text-gray-400 px-2 py-1">View only</span>
          )}
        </div>
      </td>
    </tr>
  );
};

// ✅ Main Component
const ProjectManagement: React.FC = () => {
  // ✅ State Management
  const [projects, setProjects] = useState<Project[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSubcategoryFormOpen, setIsSubcategoryFormOpen] =
    useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingSubcategory, setEditingSubcategory] =
    useState<SubcategoryOption | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterInstructionType, setFilterInstructionType] =
    useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [activeTab, setActiveTab] = useState<
    "projects" | "subcategories" | "roles"
  >("projects");

  const [subcategorySearchTerm, setSubcategorySearchTerm] =
    useState<string>("");
  const [subcategoryFilterCategory, setSubcategoryFilterCategory] =
    useState<string>("all");
  const [subcategoryFilterStatus, setSubcategoryFilterStatus] =
    useState<string>("all");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [shouldLoadPreview, setShouldLoadPreview] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const navigate = useNavigate();

  const [showQuickAddSubcategory, setShowQuickAddSubcategory] = useState(false);
  const [quickAddSubcategoryName, setQuickAddSubcategoryName] = useState("");
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);

  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roleSubcategories, setRoleSubcategories] = useState<
    SubcategoryOption[]
  >([]);

  const MANAGEABLE_ROLES = ["Marketing", "Designer", "Video Editor", "Content"];

  const [currentUser, setCurrentUser] = useState<{
    email: string;
    role: string;
    id?: string;
  } | null>(null);

  const [configDrafts, setConfigDrafts] = useState<
    Map<
      string,
      {
        promptContent: string;
        instructions: string;
        name: string;
      }
    >
  >(new Map());

  // ✅ Add sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch("/api/roles");
      const data = await response.json();

      if (data.success) {
        // Should already exclude Admin from backend
        setRoles(data.roles);
        console.log(`📊 Loaded ${data.roles.length} manageable roles`);
      } else {
        setRoles(MANAGEABLE_ROLES);
        console.log("⚠️ Using local manageable roles");
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      setRoles(MANAGEABLE_ROLES);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/verify", {
          credentials: "include",
        });

        const data = await response.json();

        if (data.success && data.user) {
          setCurrentUser(data.user);
          console.log("✅ Current user loaded:", data.user);
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  const handleFormSubcategoryReorder = async (reorderedItems: any[]) => {
    console.log("🔄 Reordering subcategories from form modal:", reorderedItems);

    try {
      const response = await fetch("/api/subcategories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subcategories: reorderedItems }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log("✅ Subcategories reordered successfully");

        // Refresh subcategories list
        await fetchSubcategories();

        showNotification(
          "success",
          "Order Updated!",
          "Subcategories reordered successfully."
        );
      } else {
        console.error("❌ Failed to reorder:", data.error);
        showNotification(
          "error",
          "Reorder Failed",
          data.error || "Failed to save new order."
        );
      }
    } catch (error) {
      console.error("❌ Error reordering subcategories:", error);
      showNotification(
        "error",
        "Network Error",
        "Failed to reorder subcategories."
      );
    }
  };

  // ✅ Handle subcategory reorder
  const handleSubcategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = filteredSubcategories.findIndex(
      (item) => item.id === active.id
    );
    const newIndex = filteredSubcategories.findIndex(
      (item) => item.id === over.id
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredSubcategories, oldIndex, newIndex);

    // Update order field
    const withNewOrder = reordered.map((item, index) => ({
      ...item,
      order: index,
    }));

    // Optimistic update
    setSubcategories((prev) => {
      const others = prev.filter(
        (s) => !withNewOrder.some((updated) => updated.id === s.id)
      );
      return [...others, ...withNewOrder].sort(
        (a, b) => (a.order || 0) - (b.order || 0)
      );
    });

    // Save to server
    try {
      const response = await fetch("/api/subcategories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subcategories: withNewOrder }),
      });

      const data = await response.json();

      if (data.success) {
        showNotification(
          "success",
          "Order Updated!",
          "Subcategories reordered successfully."
        );
        console.log("✅ Subcategories reordered successfully");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Failed to reorder subcategories:", error);
      showNotification("error", "Reorder Failed", "Failed to save new order.");
      // Rollback on error
      await fetchSubcategories();
    }
  };

  // Helper to generate unique key for each configuration
  const getConfigKey = (
    category: string,
    subcategory: string,
    targetModel: string,
    instructionType: string
  ) => {
    return `${category}__${subcategory}__${targetModel}__${instructionType}`;
  };

  const handleToggleRoleAccess = async (
    role: string,
    subcategoryId: string,
    hasAccess: boolean
  ) => {
    try {
      const subcategory = subcategories.find((sub) => sub.id === subcategoryId);
      if (!subcategory) return;

      let allowedRoles = subcategory.allowedRoles || [];

      if (hasAccess) {
        if (!allowedRoles.includes(role)) {
          allowedRoles = [...allowedRoles, role];
        }
      } else {
        allowedRoles = allowedRoles.filter((r) => r !== role);
      }

      const response = await fetch(
        `/api/subcategories/${subcategoryId}/roles`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowedRoles }),
        }
      );

      const data = await response.json();

      if (data.success) {
        await fetchSubcategories();
        showNotification("success", "Updated!", `Access updated for ${role}`);
      } else {
        showNotification("error", "Failed", data.error);
      }
    } catch (error) {
      showNotification("error", "Error", error.message);
    }
  };

  const fetchRoleSubcategories = async (role: string) => {
    try {
      const response = await fetch(`/api/roles/${role}/subcategories`);
      const data = await response.json();

      if (data.success) {
        setRoleSubcategories(data.subcategories);
      }
    } catch (error) {
      console.error("Failed to fetch role subcategories:", error);
    }
  };

  const loadContentByConfig = async (
    category: string,
    subcategory: string,
    targetModel: string,
    instructionType: string
  ) => {
    if (!subcategory) {
      // Nếu không có subcategory, clear content
      setFormData((prev) => ({
        ...prev,
        promptContent: "",
        instructions: "",
        name: "",
      }));
      return;
    }

    try {
      setIsLoadingContent(true);

      const response = await fetch("/api/instructions/load-by-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          subcategory,
          targetModel,
          instructionType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.exists) {
          console.log(`Loaded existing content: ${data.filename}`);

          setFormData((prev) => ({
            ...prev,
            promptContent: data.promptContent || "",
            instructions: data.instructions || "",
            name: data.project || prev.name,
          }));

          showNotification(
            "info",
            "Content Loaded",
            `Loaded from: ${data.filename}`
          );
        } else {
          console.log(`No existing content for: ${data.filename}`);

          // Clear content cho subcategory mới
          setFormData((prev) => ({
            ...prev,
            promptContent: "",
            instructions: "",
          }));

          showNotification(
            "info",
            "New Subcategory",
            "No existing content. You can create new instructions here."
          );
        }
      }
    } catch (error) {
      console.error("Failed to load content:", error);
      showNotification("error", "Load Failed", "Could not load content");
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Add this helper function in ProjectManagement.tsx
const getAccessibleSubcategoriesForCategory = (
  category: string,
  user: { role: string; id?: string } | null
): SubcategoryOption[] => {
  if (!user) return [];
  
  // Admin sees all
  if (user.role === 'Admin') {
    return subcategories.filter(sub => sub.category === category);
  }
  
  // Other roles see only allowed or created by them
  return subcategories.filter(sub => {
    if (sub.category !== category) return false;
    if (sub.createdBy?.userId === user.id) return true;
    if (sub.allowedRoles?.includes(user.role)) return true;
    return false;
  });
};

  const [formData, setFormData] = useState<FormData>({
    name: "",
    promptContent: "",
    instructions: "",
    category: "google-ads",
    subcategory: "",
    targetModel: "universal",
    instructionType: "user",
    status: "active",
  });

  const [subcategoryFormData, setSubcategoryFormData] =
    useState<SubcategoryFormData>({
      value: "",
      label: "",
      category: "google-ads",
      status: "active",
    });

  // ✅ Configuration
  const parentCategories: CategoryOption[] = [
    {
      value: "google-ads",
      label: "Google Ads",
      icon: Target,
      color: "bg-blue-50 text-blue-700",
      description: "Search, Display & Shopping campaigns",
    },
    {
      value: "facebook-ads",
      label: "Facebook Ads",
      icon: Share2,
      color: "bg-indigo-50 text-indigo-700",
      description: "Social media advertising campaigns",
    },
    {
      value: "website-content",
      label: "Website Content",
      icon: Globe,
      color: "bg-emerald-50 text-emerald-700",
      description: "Website and content marketing visuals",
    },
    {
      value: "social",
      label: "Social",
      icon: Users,
      color: "bg-emerald-50 text-emerald-700",
      description: "Social",
    },
    {
      value: "instructions",
      label: "Instructions",
      icon: BookOpen,
      color: "bg-emerald-50 text-emerald-700",
      description: "Instructions",
    },
  ];

  const modelOptions = [
    {
      value: "universal",
      label: "Claude",
      color: "bg-purple-50 text-purple-700",
      icon: Brain,
    },
    {
      value: "deepseek",
      label: "DeepSeek",
      color: "bg-green-50 text-green-700",
      icon: Zap,
    },
  ];

  const instructionTypeOptions = [
    {
      value: "system",
      label: "System Prompt",
      color: "bg-blue-50 text-blue-700",
      icon: Settings,
    },
    {
      value: "user",
      label: "User Prompt",
      color: "bg-orange-50 text-orange-700",
      icon: User,
    },
  ];

  const statusOptions = [
    {
      value: "active",
      label: "Active",
      color: "bg-green-50 text-green-700 border-green-200",
    },
    {
      value: "inactive",
      label: "Inactive",
      color: "bg-gray-50 text-gray-700 border-gray-200",
    },
    {
      value: "private",
      label: "Private",
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
  ];

  const handleDeleteSelectedSubcategory = async () => {
    if (!formData.subcategory) return;

    // Find subcategory data
    const subcategoryToDelete = subcategories.find(
      (sub) =>
        sub.category === formData.category && sub.value === formData.subcategory
    );

    if (!subcategoryToDelete) {
      showNotification("error", "Not Found", "Subcategory not found.");
      return;
    }

    // Count related files
    const relatedFiles = projects.filter(
      (p) =>
        p.category === formData.category &&
        p.subcategory === formData.subcategory
    );

    // Confirm deletion with file count
    const confirmMessage =
      relatedFiles.length > 0
        ? `Are you sure you want to delete "${
            subcategoryToDelete.label
          }"?\n\nThis will also delete ${
            relatedFiles.length
          } related file(s):\n${relatedFiles
            .map((p) => `• ${p.filename}`)
            .join("\n")}\n\nThis action cannot be undone.`
        : `Are you sure you want to delete "${subcategoryToDelete.label}"?\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/subcategories/${subcategoryToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh both subcategories and projects
        await fetchSubcategories();
        await fetchProjects();

        // Clear selected subcategory
        setFormData({
          ...formData,
          subcategory: "",
          promptContent: "",
          instructions: "",
        });

        const message =
          data.deletedFilesCount > 0
            ? `"${subcategoryToDelete.label}" and ${data.deletedFilesCount} related file(s) deleted successfully.`
            : `"${subcategoryToDelete.label}" deleted successfully.`;

        showNotification("success", "Deleted!", message);

        console.log(
          `✅ Deleted subcategory and ${data.deletedFilesCount} files`
        );
      } else {
        showNotification("error", "Delete Failed", data.error);
      }
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      showNotification(
        "error",
        "Network Error",
        "Failed to delete subcategory."
      );
    }
  };

  const handleQuickAddSubcategory = async () => {
    if (!quickAddSubcategoryName.trim()) return;

    try {
      setSavingQuickAdd(true);

      const slug = generateSlug(quickAddSubcategoryName);

      const response = await fetch("/api/subcategories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: slug,
          label: quickAddSubcategoryName.trim(),
          category: formData.category,
          status: "active",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh subcategories list
        await fetchSubcategories();

        // Auto-select the new subcategory
        setFormData({
          ...formData,
          subcategory: slug,
        });

        // Close quick add form
        setShowQuickAddSubcategory(false);
        setQuickAddSubcategoryName("");

        showNotification(
          "success",
          "Subcategory Added!",
          `"${quickAddSubcategoryName}" has been created and selected.`
        );
      } else {
        if (response.status === 409) {
          showNotification(
            "warning",
            "Already Exists",
            `A subcategory with this name already exists in ${formData.category}.`
          );
        } else {
          showNotification("error", "Failed to Add", data.error);
        }
      }
    } catch (error) {
      console.error("Error adding subcategory:", error);
      showNotification("error", "Network Error", "Failed to add subcategory.");
    } finally {
      setSavingQuickAdd(false);
    }
  };

  // ✅ Notification Helper
  const showNotification = (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string
  ) => {
    setNotification({ type, title, message });
  };

  // ✅ API Functions for Projects
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/instructions/projects");
      const data = await response.json();

      if (data.success) {
        setProjects(data.projects);
        console.log(`📊 Loaded ${data.projects.length} instruction projects`);
      } else {
        console.error("Failed to fetch projects:", data.error);
        showNotification(
          "error",
          "Failed to Load",
          "Could not fetch instruction projects."
        );
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      showNotification(
        "error",
        "Network Error",
        "Failed to connect to server."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const previewInstructionContent = async () => {
    try {
      if (editingProject && !shouldLoadPreview) {
        return;
      }

      const configKey = getConfigKey(
        formData.category,
        formData.subcategory,
        formData.targetModel,
        formData.instructionType
      );

      // Check if we have a draft for this configuration
      const existingDraft = configDrafts.get(configKey);

      if (existingDraft) {
        console.log(`📝 Loading draft for config: ${configKey}`);

        setFormData((prev) => ({
          ...prev,
          promptContent: existingDraft.promptContent,
          instructions: existingDraft.instructions,
          name: existingDraft.name,
        }));

        return; // Don't fetch from API if we have draft
      }

      // If no draft, fetch from API
      const response = await fetch("/api/instructions/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: formData.category,
          subcategory: formData.subcategory,
          targetModel: formData.targetModel,
          instructionType: formData.instructionType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.exists) {
          console.log(`📖 Loading existing content from: ${data.filename}`);

          setFormData((prev) => ({
            ...prev,
            promptContent: data.promptContent || "",
            instructions: data.instructions || "",
            name: data.project?.project || prev.name,
          }));

          showNotification(
            "info",
            "Existing Content Loaded",
            `Found existing instruction file: ${data.filename}`
          );
        } else {
          console.log(`📝 No existing content for: ${data.filename}`);

          setFormData((prev) => ({
            ...prev,
            promptContent: "",
            instructions: "",
          }));
        }
      }
    } catch (error) {
      console.error("Failed to preview content:", error);
    }
  };

  // ✅ NEW: API Functions for Subcategories
  const fetchSubcategories = useCallback(async () => {
    try {
      setLoadingSubcategories(true);
      console.log("🔄 ProjectManagement: Fetching subcategories from API...");

      const response = await fetch("/api/subcategories");
      const data = await response.json();

      if (data.success) {
        // ✅ FIX: Sort by order before setting state
        const sorted = data.subcategories.sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        );
        setSubcategories(sorted);
        console.log(
          `📊 ProjectManagement: Loaded ${sorted.length} subcategories (sorted by order)`
        );
      } else {
        console.error(
          "ProjectManagement: Failed to fetch subcategories:",
          data.error
        );
        setSubcategories([]);
      }
    } catch (error) {
      console.error("ProjectManagement: Error fetching subcategories:", error);
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  }, []);

  const generateSlug = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  };

  const saveSubcategory = async (subcategoryData: SubcategoryFormData) => {
    try {
      setSaving(true);
      console.log("💾 Saving subcategory to API...", subcategoryData);

      const requestBody = {
        ...subcategoryData,
        id: editingSubcategory ? editingSubcategory.id : undefined,
      };

      const response = await fetch("/api/subcategories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        // ✅ FIXED: Only refresh data, no tab switching
        await fetchSubcategories();

        const action = editingSubcategory ? "updated" : "created";
        showNotification(
          "success",
          "Success!",
          `Subcategory ${action} successfully.`
        );

        console.log(`✅ Subcategory ${action} successfully`);

        return { success: true, message: data.message };
      } else {
        if (response.status === 409 && data.error.includes("already exists")) {
          showNotification(
            "warning",
            "Duplicate Subcategory!",
            `A subcategory with value "${subcategoryData.value}" already exists in ${subcategoryData.category}.`
          );
        } else {
          showNotification("error", "Save Failed", data.error);
        }
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error saving subcategory:", error);
      showNotification("error", "Network Error", "Failed to save subcategory.");
      return { success: false, error: (error as Error).message };
    } finally {
      setSaving(false);
    }
  };

  const deleteSubcategory = async (id: string) => {
    try {
      console.log("🗑️ Deleting subcategory:", id);

      const response = await fetch(`/api/subcategories/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // ✅ FIXED: Only refresh data, no tab switching
        await fetchSubcategories();
        showNotification(
          "success",
          "Deleted!",
          "Subcategory deleted successfully."
        );
        console.log(`✅ Subcategory deleted successfully: ${id}`);

        return { success: true };
      } else {
        if (response.status === 409 && data.usedByProjects) {
          const projectsList = data.usedByProjects
            .map((p: any) => `• ${p.project}`)
            .join("\n");

          showNotification(
            "warning",
            "Cannot Delete!",
            `This subcategory is being used by ${data.usedByProjects.length} project(s):\n\n${projectsList}\n\nPlease update or delete these projects first.`
          );
        } else {
          showNotification("error", "Delete Failed", data.error);
        }
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      showNotification(
        "error",
        "Network Error",
        "Failed to delete subcategory."
      );
      return { success: false, error: (error as Error).message };
    }
  };

  const updateSubcategoryStatus = async (id: string, status: string) => {
    try {
      console.log(`🔄 Updating subcategory status: ${id} → ${status}`);

      const response = await fetch(`/api/subcategories/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (data.success) {
        // ✅ FIXED: Only refresh data, no tab switching
        await fetchSubcategories();
        showNotification(
          "success",
          "Status Updated!",
          `Subcategory is now ${status}.`
        );
        console.log(`✅ Subcategory status updated: ${id} → ${status}`);

        return { success: true };
      } else {
        showNotification("error", "Update Failed", data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error updating subcategory status:", error);
      showNotification("error", "Network Error", "Failed to update status.");
      return { success: false, error: (error as Error).message };
    }
  };

  const handleDisplayNameChange = (displayName: string) => {
    setSubcategoryFormData({
      ...subcategoryFormData,
      label: displayName,
      value: generateSlug(displayName), // ✅ Auto-generate slug
    });
  };

  // ✅ Other existing API functions (saveProject, deleteProject, etc.) remain the same
  const saveProject = async (projectData: FormData) => {
    try {
      setSaving(true);

      const requestBody = {
        ...projectData,
        originalFilename: editingProject ? editingProject.filename : null,
      };

      const response = await fetch("/api/instructions/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        // ❌ XÓA DÒNG NÀY - không fetch lại projects
        // await fetchProjects();

        showNotification("success", "Saved!", data.message);
        return { success: true, message: data.message };
      } else {
        if (response.status === 409 && data.type === "CONFIGURATION_CONFLICT") {
          showConflictError(data);
        } else {
          showNotification("error", "Save Failed", data.error);
        }
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error saving project:", error);
      showNotification("error", "Network Error", "Failed to save project.");
      return { success: false, error: (error as Error).message };
    } finally {
      setSaving(false);
    }
  };

  const showConflictError = (conflictData: any) => {
    const conflicting = conflictData.conflictingProject;

    const errorMessage = `
Configuration conflict detected!

Existing project: "${conflicting.project}"
• Category: ${conflicting.category}
• Subcategory: ${conflicting.subcategory || "(none)"}
• Type: ${conflicting.instructionType}
• Model: ${conflicting.targetModel}

Suggestions to resolve:
${conflictData.suggestions.map((s: string) => `• ${s}`).join("\n")}
  `.trim();

    showNotification("warning", "Configuration Conflict!", errorMessage);
  };

  const deleteProject = async (filename: string) => {
    try {
      const response = await fetch(`/api/instructions/projects/${filename}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        await fetchProjects();
        showNotification(
          "success",
          "Deleted!",
          "Project deleted successfully."
        );
        return { success: true };
      } else {
        showNotification("error", "Delete Failed", data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      showNotification("error", "Network Error", "Failed to delete project.");
      return { success: false, error: (error as Error).message };
    }
  };

  const updateProjectStatus = async (filename: string, status: string) => {
    try {
      const response = await fetch(
        `/api/instructions/projects/${filename}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (data.success) {
        await fetchProjects();
        showNotification(
          "success",
          "Status Updated!",
          `Project is now ${status}.`
        );
        return { success: true };
      } else {
        showNotification("error", "Update Failed", data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error updating project status:", error);
      showNotification("error", "Network Error", "Failed to update status.");
      return { success: false, error: (error as Error).message };
    }
  };

  const loadProjectContent = async (filename: string) => {
    try {
      const response = await fetch(`/api/instructions/content/${filename}`);
      const data = await response.json();

      if (data.success) {
        return {
          promptContent: data.promptContent || "",
          instructions: data.instructions || data.content || "", // fallback cho backward compatibility
        };
      } else {
        showNotification(
          "error",
          "Load Failed",
          "Could not load project content."
        );
        return {
          promptContent: "",
          instructions: "",
        };
      }
    } catch (error) {
      console.error("Error loading project content:", error);
      showNotification("error", "Network Error", "Failed to load content.");
      return {
        promptContent: "",
        instructions: "",
      };
    }
  };

  // ✅ Load data on mount
  useEffect(() => {
    fetchProjects();
    fetchSubcategories();
  }, []);

  useEffect(() => {
    if (isFormOpen && formData.category && formData.subcategory) {
      // Debounce để tránh gọi API liên tục
      const timer = setTimeout(() => {
        loadContentByConfig(
          formData.category,
          formData.subcategory,
          formData.targetModel,
          formData.instructionType
        );
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [
    formData.category,
    formData.subcategory,
    formData.targetModel,
    formData.instructionType,
    isFormOpen,
  ]);

  useEffect(() => {
    if (shouldLoadPreview && formData.category && formData.subcategory) {
      const debounceTimer = setTimeout(() => {
        previewInstructionContent();
        setShouldLoadPreview(false);
      }, 300); // Debounce to avoid too many requests

      return () => clearTimeout(debounceTimer);
    }
  }, [
    formData.category,
    formData.subcategory,
    formData.targetModel,
    formData.instructionType,
    shouldLoadPreview,
  ]);

  useEffect(() => {
    if (isFormOpen && formData.category && formData.subcategory) {
      const configKey = getConfigKey(
        formData.category,
        formData.subcategory,
        formData.targetModel,
        formData.instructionType
      );

      // Only save if content has actual data
      if (formData.promptContent || formData.instructions || formData.name) {
        setConfigDrafts((prev) => {
          const newDrafts = new Map(prev);
          newDrafts.set(configKey, {
            promptContent: formData.promptContent,
            instructions: formData.instructions,
            name: formData.name,
          });
          return newDrafts;
        });
      }
    }
  }, [
    formData.promptContent,
    formData.instructions,
    formData.name,
    formData.category,
    formData.subcategory,
    formData.targetModel,
    formData.instructionType,
    isFormOpen,
  ]);

  // ✅ Utility Functions
  const getTimeAgo = (date: string): string => {
    const now = new Date();
    const updatedDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - updatedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification("success", "Copied!", `${label} copied to clipboard.`);
    } catch (error) {
      showNotification("error", "Copy Failed", "Could not copy to clipboard.");
    }
  };

  // ✅ Get active subcategories for category
  const getActiveSubcategoriesForCategory = (
    category: string
  ): SubcategoryOption[] => {
    return subcategories.filter(
      (sub) => sub.category === category && sub.status === "active"
    );
  };

  // ✅ Filtering and Sorting
  const getSortedProjects = (projects: Project[]): Project[] => {
    const statusPriority = { active: 0, paused: 1, inactive: 2 };

    switch (sortBy) {
      case "recent":
        return [...projects].sort(
          (a, b) =>
            new Date(b.lastModified).getTime() -
            new Date(a.lastModified).getTime()
        );
      case "name":
        return [...projects].sort((a, b) => a.project.localeCompare(b.project));
      case "status":
        return [...projects].sort((a, b) => {
          const statusDiff =
            statusPriority[a.status as keyof typeof statusPriority] -
            statusPriority[b.status as keyof typeof statusPriority];
          if (statusDiff !== 0) return statusDiff;
          return (
            new Date(b.lastModified).getTime() -
            new Date(a.lastModified).getTime()
          );
        });
      case "category":
        return [...projects].sort((a, b) => {
          const catDiff = a.category.localeCompare(b.category);
          if (catDiff !== 0) return catDiff;
          return a.subcategory.localeCompare(b.subcategory);
        });
      default:
        return projects;
    }
  };

  const filteredProjects = getSortedProjects(
    projects.filter((project) => {
      const matchesSearch =
        project.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.filename.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        filterCategory === "all" || project.category === filterCategory;
      const matchesStatus =
        filterStatus === "all" || project.status === filterStatus;
      const matchesModel =
        filterModel === "all" || project.targetModel === filterModel;
      const matchesInstructionType =
        filterInstructionType === "all" ||
        project.instructionType === filterInstructionType;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesModel &&
        matchesInstructionType
      );
    })
  );

  const filteredSubcategories = subcategories.filter((subcategory) => {
    const matchesSearch =
      subcategory.label
        .toLowerCase()
        .includes(subcategorySearchTerm.toLowerCase()) ||
      subcategory.value
        .toLowerCase()
        .includes(subcategorySearchTerm.toLowerCase());
    const matchesCategory =
      subcategoryFilterCategory === "all" ||
      subcategory.category === subcategoryFilterCategory;
    const matchesStatus =
      subcategoryFilterStatus === "all" ||
      subcategory.status === subcategoryFilterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // ✅ Project Management Handlers
  const handleCreateNew = () => {
    setEditingProject(null);
    const firstSubcat = getActiveSubcategoriesForCategory("google-ads")[0];

    setFormData({
      name: "",
      promptContent: "",
      instructions: "",
      category: "google-ads",
      subcategory: firstSubcat?.value || "",
      targetModel: "universal",
      instructionType: "system",
      status: "active",
    });

    setIsFormOpen(true);
    // Content sẽ được load tự động bởi useEffect
  };

  // Trong handleEdit (dòng ~770)
  const handleEdit = async (project: Project) => {
    setEditingProject(project);

    setFormData({
      name: project.project,
      promptContent: "", // Sẽ được load bởi useEffect
      instructions: "", // Sẽ được load bởi useEffect
      category: project.category,
      subcategory: project.subcategory,
      targetModel: project.targetModel,
      instructionType: project.instructionType,
      status: project.status,
    });

    setIsFormOpen(true);
    // Content sẽ được load tự động bởi useEffect
  };

  const handleSave = async () => {
    const result = await saveProject(formData);
    if (result.success) {
      // Không setIsFormOpen(false) nữa
      // Không setEditingProject(null) nữa
      // Chỉ thông báo thành công
      console.log("Content saved successfully");
    }
  };

  const handleDelete = async (project: Project) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${project.project}"?\n\nThis action cannot be undone.`
      )
    ) {
      await deleteProject(project.filename);
    }
  };

  const handleNavigateToHome = () => {
    navigate("/");
  };

  const handleStatusToggle = async (project: Project) => {
    const newStatus = project.status === "active" ? "inactive" : "active";
    await updateProjectStatus(project.filename, newStatus);
  };

  const handleParentCategoryChange = (newParent: string) => {
    const firstChild = getActiveSubcategoriesForCategory(newParent)[0];
    setFormData({
      ...formData,
      category: newParent,
      subcategory: firstChild?.value || "",
    });
    setShouldLoadPreview(true); // Enable preview on category change
  };

  const handleSubcategoryChange = (newSubcategory: string) => {
    setFormData({
      ...formData,
      subcategory: newSubcategory,
    });
    // Content sẽ được load tự động bởi useEffect
  };

  // Add new handler for model change
  const handleModelChange = (newModel: string) => {
    setFormData({
      ...formData,
      targetModel: newModel,
    });
    // Content sẽ được load tự động bởi useEffect
  };

  // Add new handler for instruction type change
  const handleInstructionTypeChange = (newType: string) => {
    setFormData({
      ...formData,
      instructionType: newType,
    });
    // Content sẽ được load tự động bởi useEffect
  };

  // ✅ NEW: Subcategory Management Handlers
  const handleCreateNewSubcategory = () => {
    setEditingSubcategory(null);
    setSubcategoryFormData({
      value: "",
      label: "",
      category: "google-ads",
      status: "active",
    });
    setIsSubcategoryFormOpen(true);
  };

  const handleEditSubcategory = (subcategory: SubcategoryOption) => {
    setEditingSubcategory(subcategory);
    setSubcategoryFormData({
      value: subcategory.value,
      label: subcategory.label,
      category: subcategory.category,
      status: subcategory.status,
    });
    setIsSubcategoryFormOpen(true);
  };

  const handleSaveSubcategory = async () => {
    console.log("🔄 handleSaveSubcategory called - current tab:", activeTab);

    const result = await saveSubcategory(subcategoryFormData);
    if (result.success) {
      console.log("✅ saveSubcategory success - staying on tab:", activeTab);

      setIsSubcategoryFormOpen(false);
      setEditingSubcategory(null);
    }
  };

  const handleDeleteSubcategory = async (subcategory: SubcategoryOption) => {
    console.log("🔄 handleDeleteSubcategory called - current tab:", activeTab);

    if (
      window.confirm(
        `Are you sure you want to delete "${subcategory.label}"?\n\nThis action cannot be undone.`
      )
    ) {
      const result = await deleteSubcategory(subcategory.id);
    }
  };

  const handleSubcategoryStatusToggle = async (
    subcategory: SubcategoryOption
  ) => {
    console.log(
      "🔄 handleSubcategoryStatusToggle called - current tab:",
      activeTab
    );

    const newStatus = subcategory.status === "active" ? "inactive" : "active";
    const result = await updateSubcategoryStatus(subcategory.id, newStatus);
  };

  // ✅ Helper Functions
  const getParentCategoryData = (value: string) => {
    return parentCategories.find((cat) => cat.value === value);
  };

  const getSubcategoryData = (parent: string, child: string) => {
    return subcategories.find(
      (sub) => sub.category === parent && sub.value === child
    );
  };

  const getStatusStyle = (status: string) => {
    return (
      statusOptions.find((s) => s.value === status)?.color ||
      "bg-gray-50 text-gray-700"
    );
  };

  const getModelStyle = (model: string) => {
    return (
      modelOptions.find((m) => m.value === model)?.color ||
      "bg-gray-50 text-gray-700"
    );
  };

  const getInstructionTypeStyle = (type: string) => {
    return (
      instructionTypeOptions.find((t) => t.value === type)?.color ||
      "bg-gray-50 text-gray-700"
    );
  };

  // ✅ Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading instruction projects...</span>
        </div>
      </div>
    );
  }

  // ✅ Main Render
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ✅ Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div>
                <button
                  onClick={handleNavigateToHome}
                  className="flex items-center text-gray-800 hover:text-gray-900"
                  aria-label="Back"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>


                <h1 className="text-4xl font-bold text-gray-900 mb-3">
                  Instruction Management
                </h1>
              </div>
              <p className="text-gray-600">
                Manage AI instruction prompts and subcategories for dynamic
                content generation
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  fetchProjects();
                  fetchSubcategories();
                }}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <div className="text-sm text-gray-500">
                {projects.length} projects • {subcategories.length}{" "}
                subcategories
              </div>
            </div>
          </div>
        </div>

        {/* ✅ NEW: Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("projects")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "projects"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Projects</span>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {filteredProjects.length}
                  </span>
                </div>
              </button>

              {/* ✅ Subcategories tab - Available for ALL roles */}
              <button
                onClick={() => setActiveTab("subcategories")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "subcategories"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Tags className="w-5 h-5" />
                  <span>Subcategories</span>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {subcategories.length}
                  </span>
                </div>
              </button>

              {/* ✅ Roles tab - ONLY for Admin */}
              {currentUser?.role === "Admin" && (
                <button
                  onClick={() => setActiveTab("roles")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "roles"
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Roles</span>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {roles.length}
                    </span>
                  </div>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* ✅ Projects Tab */}
        {activeTab === "projects" && (
          <>
            {/* Enhanced Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex flex-col space-y-4">
                {/* Search */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search projects and filenames..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent w-full"
                    />
                  </div>
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center space-x-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    <span>New Project</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white text-sm"
                  >
                    <option value="all">All Categories</option>
                    {parentCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterModel}
                    onChange={(e) => setFilterModel(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white text-sm"
                  >
                    <option value="all">All Models</option>
                    {modelOptions.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterInstructionType}
                    onChange={(e) => setFilterInstructionType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white text-sm"
                  >
                    <option value="all">All Types</option>
                    {instructionTypeOptions.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white text-sm"
                  >
                    <option value="all">All Status</option>
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white text-sm"
                  >
                    <option value="recent">Recently Updated</option>
                    <option value="name">Name A-Z</option>
                    <option value="status">Status</option>
                    <option value="category">Category</option>
                  </select>

                  <div className="text-sm text-gray-500 ml-auto">
                    {filteredProjects.length} projects shown
                  </div>
                </div>
              </div>
            </div>

            {/* Projects Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Category
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Subcategories
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Files
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Status
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Last Updated
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
            {parentCategories
              .filter((category) => {
                // ✅ SIMPLIFIED: Only filter by category filter
                if (
                  filterCategory !== "all" &&
                  filterCategory !== category.value
                ) {
                  return false;
                }
                
                // ✅ ALWAYS SHOW ALL CATEGORIES - No subcategory check
                return true;
              })
              .map((category) => {
                const Icon = category.icon;
                
                // ✅ Get accessible subcategories (for display only)
                const accessibleSubcategories = getAccessibleSubcategoriesForCategory(
                  category.value,
                  currentUser
                );

                // ✅ Get ALL projects for this category (not filtered by subcategory access)
                const allCategoryProjects = projects.filter(
                  (p) => p.category === category.value
                );

                // ✅ Filter projects for display based on role
                const visibleProjects = currentUser?.role === 'Admin'
                  ? allCategoryProjects
                  : allCategoryProjects.filter((p) =>
                      accessibleSubcategories.some(
                        sub => sub.value === p.subcategory
                      )
                    );

                // Get unique subcategories from visible projects
                const uniqueSubcategories = [
                  ...new Set(visibleProjects.map((p) => p.subcategory)),
                ];

                const lastModified = visibleProjects.length > 0
                  ? visibleProjects.reduce((latest, project) => {
                      const projectDate = new Date(project.lastModified).getTime();
                      return projectDate > latest ? projectDate : latest;
                    }, 0)
                  : Date.now();

                const activeFiles = visibleProjects.filter(
                  (p) => p.status === "active"
                ).length;
                const inactiveFiles = visibleProjects.filter(
                  (p) => p.status === "inactive"
                ).length;
                const privateFiles = visibleProjects.filter(
                  (p) => p.status === "private"
                ).length;

                return (
                  <tr
                    key={category.value}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Category */}
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${category.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">
                            {category.label}
                          </h3>
                          <div className="text-xs text-gray-500">
                            {category.description}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Subcategories */}
                    <td className="py-4 px-6">
                      {uniqueSubcategories.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {uniqueSubcategories
                              .slice(0, 3)
                              .map((subcategoryValue) => {
                                const subcategoryData = getSubcategoryData(
                                  category.value,
                                  subcategoryValue
                                );
                                return (
                                  <span
                                    key={subcategoryValue}
                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                                  >
                                    {subcategoryData?.label || subcategoryValue}
                                  </span>
                                );
                              })}
                            {uniqueSubcategories.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                                +{uniqueSubcategories.length - 3} more
                              </span>
                            )}
                          </div>
                          {currentUser?.role !== 'Admin' && visibleProjects.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              Showing {uniqueSubcategories.length} accessible subcategories
                            </div>
                          )}
                        </>
                      ) : (
                        // ✅ No subcategories - Show message
                        <div className="text-sm text-gray-500 italic">
                          {currentUser?.role === 'Admin' 
                            ? 'No subcategories yet'
                            : 'No accessible subcategories'
                          }
                        </div>
                      )}
                    </td>

                    {/* Files Count */}
                    <td className="py-4 px-6">
                      {visibleProjects.length > 0 ? (
                        <>
                          <div className="text-sm text-gray-900 font-medium">
                            {visibleProjects.length} files
                          </div>
                          <div className="text-xs text-gray-500 mt-1 space-x-2">
                            {activeFiles > 0 && (
                              <span className="text-green-600">
                                {activeFiles} active
                              </span>
                            )}
                            {inactiveFiles > 0 && (
                              <span className="text-gray-500">
                                {inactiveFiles} inactive
                              </span>
                            )}
                            {privateFiles > 0 && (
                              <span className="text-purple-600">
                                {privateFiles} private
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        // ✅ No files
                        <div className="text-sm text-gray-400 italic">
                          No files yet
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                          activeFiles > 0
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}
                      >
                        {activeFiles > 0 ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Last Updated */}
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>
                          {getTimeAgo(new Date(lastModified).toISOString())}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        {/* ✅ ALL users can click to manage content */}
                        <button
                          onClick={() => {
                            // Get first accessible subcategory or empty
                            const firstSubcat = accessibleSubcategories[0]?.value || "";
                            
                            setFormData({
                              name: "",
                              promptContent: "",
                              instructions: "",
                              category: category.value,
                              subcategory: firstSubcat,
                              targetModel: "universal",
                              instructionType: "system",
                              status: "active",
                            });
                            setIsFormOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={accessibleSubcategories.length === 0 
                            ? "Create new subcategory and content"
                            : "Manage content"
                          }
                        >
                          {accessibleSubcategories.length === 0 ? (
                            <Plus className="w-4 h-4" />
                          ) : (
                            <Edit2 className="w-4 h-4" />
                          )}
                        </button>
                        
                        {/* ✅ Only Admin can delete all */}
                        {currentUser?.role === 'Admin' && visibleProjects.length > 0 && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete all ${visibleProjects.length} files in "${category.label}"?\n\nThis action cannot be undone.`
                                )
                              ) {
                                Promise.all(
                                  visibleProjects.map((p) =>
                                    deleteProject(p.filename)
                                  )
                                ).then(() => {
                                  showNotification(
                                    "success",
                                    "Deleted!",
                                    `All files in ${category.label} deleted.`
                                  );
                                });
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete all files"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
                </table>
              </div>

              {/* Empty State */}
              {parentCategories.filter((category) => {
        if (filterCategory !== "all" && filterCategory !== category.value) {
          return false;
        }
        return true;
      }).length === 0 && (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No categories found
          </h3>
          <p className="text-gray-600">
            Try adjusting your filters
          </p>
        </div>
      )}
    </div>
          </>
        )}

        {/* ✅ NEW: Subcategories Tab */}
        {/* Subcategories Tab - Available for ALL roles */}
        {activeTab === "subcategories" && (
          <>
            {/* Subcategories Toolbar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex flex-col space-y-4">
                {/* Search */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search subcategories..."
                      value={subcategorySearchTerm}
                      onChange={(e) => setSubcategorySearchTerm(e.target.value)}
                      className="pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent w-full"
                    />
                  </div>

                  {/* ✅ Only Admin can create new subcategory */}
                  {currentUser?.role === "Admin" && (
                    <button
                      onClick={handleCreateNewSubcategory}
                      className="inline-flex items-center space-x-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      <span>New Subcategory</span>
                    </button>
                  )}
                </div>

                {/* Filters + Info */}
                <div className="flex flex-wrap items-center gap-4">
                  <select
                    value={subcategoryFilterCategory}
                    onChange={(e) =>
                      setSubcategoryFilterCategory(e.target.value)
                    }
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white text-sm"
                  >
                    <option value="all">All Categories</option>
                    {parentCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={subcategoryFilterStatus}
                    onChange={(e) => setSubcategoryFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  <div className="text-sm text-gray-500 ml-auto">
                    {/* ✅ Show filtered count + user role info */}
                    {currentUser?.role === "Admin" ? (
                      <span>
                        Viewing all {filteredSubcategories.length} subcategories
                      </span>
                    ) : (
                      <span>
                        Viewing {filteredSubcategories.length} subcategories
                        <span className="text-gray-400">
                          {" "}
                          (filtered for {currentUser?.role})
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Subcategories Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSubcategoryDragEnd}
                >
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {/* ✅ Only show drag handle for Admin */}
                        {currentUser?.role === "Admin" && (
                          <th className="w-12"></th>
                        )}
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">
                          Subcategory
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">
                          Parent Category
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">
                          Status
                        </th>
                        {/* ✅ Show access info for non-admin */}
                        {currentUser?.role !== "Admin" && (
                          <th className="text-left py-4 px-6 font-semibold text-gray-900">
                            Access
                          </th>
                        )}
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">
                          Updated
                        </th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <SortableContext
                        items={filteredSubcategories.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {filteredSubcategories.map((subcategory) => (
                          <SubcategoryRow
                            key={subcategory.id}
                            subcategory={subcategory}
                            currentUser={currentUser}
                            parentCategories={parentCategories}
                            onEdit={handleEditSubcategory}
                            onDelete={handleDeleteSubcategory}
                            onStatusToggle={handleSubcategoryStatusToggle}
                            onCopy={copyToClipboard}
                            getParentCategoryData={getParentCategoryData}
                            getStatusStyle={getStatusStyle}
                            getTimeAgo={getTimeAgo}
                          />
                        ))}
                      </SortableContext>
                    </tbody>
                  </table>
                </DndContext>
              </div>

              {/* Empty State */}
              {filteredSubcategories.length === 0 && (
                <div className="text-center py-16">
                  <Tags className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No subcategories found
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {currentUser?.role === "Admin"
                      ? "Get started by creating your first subcategory"
                      : "You don't have access to any subcategories yet. Contact an administrator."}
                  </p>
                  {currentUser?.role === "Admin" &&
                    !subcategorySearchTerm &&
                    subcategoryFilterCategory === "all" && (
                      <button
                        onClick={handleCreateNewSubcategory}
                        className="inline-flex items-center space-x-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Create First Subcategory</span>
                      </button>
                    )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Roles Tab */}
        {/* Roles Tab - Only show manageable roles */}
        {activeTab === "roles" && currentUser?.role === "Admin" && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Role Management
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Manage subcategory access for different user roles
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  {roles.length} manageable roles
                </div>
              </div>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {roles.map((role) => {
                const roleSubcats = subcategories.filter(
                  (sub) =>
                    sub.allowedRoles?.includes(role) ||
                    sub.createdBy?.role === role
                );

                return (
                  <div
                    key={role}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedRole(role);
                      fetchRoleSubcategories(role);
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {role}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {roleSubcats.length} subcategories
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Quick preview */}
                    <div className="space-y-2">
                      {roleSubcats.slice(0, 3).map((sub) => (
                        <div
                          key={sub.id}
                          className="text-sm text-gray-600 flex items-center space-x-2"
                        >
                          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                          <span className="truncate">{sub.label}</span>
                        </div>
                      ))}
                      {roleSubcats.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{roleSubcats.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {selectedRole && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Manage {selectedRole} Access
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Select which subcategories this role can access
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRole(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* Subcategories by Category */}
                {parentCategories.map((category) => {
                  const categorySubcats = subcategories.filter(
                    (sub) => sub.category === category.value
                  );

                  if (categorySubcats.length === 0) return null;

                  return (
                    <div key={category.value} className="mb-6">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                        {React.createElement(category.icon, {
                          className: "w-5 h-5",
                        })}
                        <span>{category.label}</span>
                        <span className="text-sm text-gray-500 font-normal">
                          ({categorySubcats.length} total)
                        </span>
                      </h3>

                      <div className="space-y-2">
                        {categorySubcats.map((sub) => {
                          const hasAccess =
                            sub.allowedRoles?.includes(selectedRole);
                          const isOwner = sub.createdBy?.role === selectedRole;

                          // ✅ Don't show Admin-owned subcategories in role management
                          if (sub.createdBy?.role === "Admin") {
                            return null;
                          }

                          return (
                            <label
                              key={sub.id}
                              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-all"
                            >
                              <input
                                type="checkbox"
                                checked={hasAccess || isOwner}
                                disabled={isOwner}
                                onChange={(e) =>
                                  handleToggleRoleAccess(
                                    selectedRole,
                                    sub.id,
                                    e.target.checked
                                  )
                                }
                                className="w-5 h-5 text-blue-600 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {sub.label}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {sub.value}
                                </div>
                              </div>
                              {isOwner && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  Owner
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end space-x-4 p-6 border-t bg-gray-50">
                <button
                  onClick={() => setSelectedRole(null)}
                  className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Project Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-8 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingProject
                    ? "Edit Instruction Project"
                    : "Create New Instruction Project"}
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-8 space-y-8">
                {/* Project Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter descriptive project name..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    This will be used as the display name for your instruction
                    project
                  </div>
                </div>

                {/* Configuration Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Category & Subcategory */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-4">
                        Category *
                      </label>

                      {/* Parent Category Cards */}
                      <div className="space-y-3 mb-4">
                        {parentCategories.map((category) => {
                          const Icon = category.icon;
                          const isSelected =
                            formData.category === category.value;

                          return (
                            <div
                              key={category.value}
                              onClick={() =>
                                handleParentCategoryChange(category.value)
                              }
                              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                isSelected
                                  ? "border-gray-800 bg-gray-50"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div
                                  className={`p-2 rounded-lg ${category.color}`}
                                >
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {category.label}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {category.description}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ✅ UPDATED: Dynamic Subcategory Selection */}
                      {/* Subcategory Selection with Delete Icon */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subcategory
                        </label>

                        <div className="flex items-center space-x-2">
                          {/* DraggableSelect - chỉ có các subcategories thực */}
                          <div className="relative flex-1">
                            <DraggableSelect
                              value={formData.subcategory}
                              options={getActiveSubcategoriesForCategory(
                                formData.category
                              ).map((opt) => ({
                                id: opt.id,
                                value: opt.value,
                                label: opt.label,
                                order: opt.order || 0,
                              }))}
                              onChange={handleSubcategoryChange}
                              onReorder={handleFormSubcategoryReorder}
                              placeholder="Select subcategory..."
                              disabled={
                                loadingSubcategories ||
                                !getActiveSubcategoriesForCategory(
                                  formData.category
                                ).length
                              }
                            />
                          </div>

                          {/* Delete Icon */}
                          {formData.subcategory && (
                            <button
                              onClick={() => handleDeleteSelectedSubcategory()}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                              title="Delete this subcategory"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>

                        {/* ✅ Add New Button - Always visible */}
                        {!showQuickAddSubcategory && (
                          <button
                            onClick={() => setShowQuickAddSubcategory(true)}
                            className="mt-2 inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add New Subcategory</span>
                          </button>
                        )}

                        {/* Quick Add Inline Form */}
                        {showQuickAddSubcategory && (
                          <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
                            <div className="flex items-start justify-between mb-3">
                              <label className="block text-sm font-semibold text-gray-900">
                                Quick Add Subcategory
                              </label>
                              <button
                                onClick={() => {
                                  setShowQuickAddSubcategory(false);
                                  setQuickAddSubcategoryName("");
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={quickAddSubcategoryName}
                              onChange={(e) =>
                                setQuickAddSubcategoryName(e.target.value)
                              }
                              onKeyPress={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  quickAddSubcategoryName.trim()
                                ) {
                                  handleQuickAddSubcategory();
                                }
                              }}
                              placeholder="Enter subcategory name..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                              autoFocus
                            />

                            <div className="flex items-center justify-between">
                              <div className="text-xs text-gray-500">
                                Will be added to:{" "}
                                <span className="font-medium">
                                  {
                                    parentCategories.find(
                                      (c) => c.value === formData.category
                                    )?.label
                                  }
                                </span>
                              </div>
                              <button
                                onClick={handleQuickAddSubcategory}
                                disabled={
                                  !quickAddSubcategoryName.trim() ||
                                  savingQuickAdd
                                }
                                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                {savingQuickAdd ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Adding...</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4" />
                                    <span>Add</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 mt-1">
                          {getActiveSubcategoriesForCategory(formData.category)
                            .length === 0 &&
                            !showQuickAddSubcategory && (
                              <span className="text-orange-600">
                                No active subcategories found. Click "Add New
                                Subcategory" to create one.
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Model & Type */}
                  <div className="space-y-6">
                    {/* Target Model */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        Target Model *
                      </label>
                      <div className="space-y-2">
                        {modelOptions.map((model) => {
                          const isSelected =
                            formData.targetModel === model.value;
                          const Icon = model.icon;

                          return (
                            <div
                              key={model.value}
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  targetModel: model.value,
                                })
                              }
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? "border-gray-800 bg-gray-50"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <Icon className="w-5 h-5" />
                                <div
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${model.color}`}
                                >
                                  {model.label}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Instruction Type */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">
                        Instruction Type *
                      </label>
                      <div className="space-y-2">
                        {instructionTypeOptions.map((type) => {
                          const isSelected =
                            formData.instructionType === type.value;
                          const Icon = type.icon;

                          return (
                            <div
                              key={type.value}
                              onClick={() =>
                                handleInstructionTypeChange(type.value)
                              }
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? "border-gray-800 bg-gray-50"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <Icon className="w-5 h-5" />
                                <div
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${type.color}`}
                                >
                                  {type.label}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Prompt Content
                  </label>
                  <textarea
                    value={formData.promptContent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        promptContent: e.target.value,
                      })
                    }
                    placeholder="Enter optional prompt content here (e.g., context, variables, examples)..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-vertical font-mono text-sm leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-gray-500">
                      Optional: Additional context or content to prepend before
                      instructions
                    </div>
                    <div className="text-xs text-gray-500">
                      {formData.promptContent.length} characters
                    </div>
                  </div>
                </div>

                {/* Instructions Content */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Instruction Content *
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions: e.target.value })
                    }
                    placeholder="Enter the instruction prompt content here..."
                    rows={16}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-vertical font-mono text-sm leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-gray-500">
                      This content will be used as the instruction prompt for AI
                      generation
                    </div>
                    <div className="text-xs text-gray-500">
                      {formData.instructions.length} characters
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Status
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {statusOptions.map((status) => {
                      const isSelected = formData.status === status.value;

                      return (
                        <div
                          key={status.value}
                          onClick={() =>
                            setFormData({ ...formData, status: status.value })
                          }
                          className={`p-3 border rounded-lg cursor-pointer transition-all text-center ${
                            isSelected
                              ? "border-gray-800 bg-gray-50"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}
                          >
                            {status.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-4 p-8 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingProject(null);
                  }}
                  className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    !formData.subcategory ||
                    !formData.instructions.trim() ||
                    saving ||
                    isLoadingContent
                  }
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save Content</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ NEW: Subcategory Form Modal */}
        {isSubcategoryFormOpen && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingSubcategory
                    ? "Edit Subcategory"
                    : "Create New Subcategory"}
                </h2>
                <button
                  onClick={() => setIsSubcategoryFormOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-6">
                {/* Label */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={subcategoryFormData.label}
                    onChange={(e) => handleDisplayNameChange(e.target.value)} // ✅ Use handler
                    placeholder="e.g., Shopping Image Generator"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    This is the human-readable name that will be displayed in
                    dropdowns
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Technical Value *
                  </label>
                  <input
                    type="text"
                    value={subcategoryFormData.value}
                    onChange={(e) =>
                      setSubcategoryFormData({
                        ...subcategoryFormData,
                        value: e.target.value,
                      })
                    }
                    placeholder="e.g., shopping-image-generator"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent font-mono"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    This is the internal identifier used in the system. Use
                    lowercase with hyphens.
                    {subcategoryFormData.label &&
                      !subcategoryFormData.value && (
                        <span className="text-blue-600 block mt-1">
                          💡 Auto-generated:{" "}
                          {generateSlug(subcategoryFormData.label)}
                        </span>
                      )}
                  </div>
                </div>
                {/* Parent Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Parent Category *
                  </label>
                  <div className="space-y-2">
                    {parentCategories.map((category) => {
                      const Icon = category.icon;
                      const isSelected =
                        subcategoryFormData.category === category.value;

                      return (
                        <div
                          key={category.value}
                          onClick={() =>
                            setSubcategoryFormData({
                              ...subcategoryFormData,
                              category: category.value,
                            })
                          }
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "border-gray-800 bg-gray-50"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${category.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {category.label}
                              </div>
                              <div className="text-xs text-gray-600">
                                {category.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {statusOptions.slice(0, 2).map((status) => {
                      const isSelected =
                        subcategoryFormData.status === status.value;

                      return (
                        <div
                          key={status.value}
                          onClick={() =>
                            setSubcategoryFormData({
                              ...subcategoryFormData,
                              status: status.value,
                            })
                          }
                          className={`p-3 border rounded-lg cursor-pointer transition-all text-center ${
                            isSelected
                              ? "border-gray-800 bg-gray-50"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}
                          >
                            {status.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setIsSubcategoryFormOpen(false)}
                  className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSubcategory}
                  disabled={
                    !subcategoryFormData.label.trim() ||
                    !subcategoryFormData.value.trim() ||
                    saving
                  }
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>
                        {editingSubcategory
                          ? "Update Subcategory"
                          : "Create Subcategory"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Notification */}
        {notification && (
          <Notification
            type={notification.type}
            title={notification.title}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectManagement;
