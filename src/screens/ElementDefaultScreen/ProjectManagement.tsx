import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"projects" | "subcategories">(
    "projects"
  );
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

  const [formData, setFormData] = useState<FormData>({
    name: "",
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
      value: "website-content", // ✅ NEW
      label: "Website Content",
      icon: Globe, // ✅ NEW 
      color: "bg-emerald-50 text-emerald-700", // ✅ NEW
      description: "Website and content marketing visuals", // ✅ NEW
    },
  ];

  const modelOptions = [
    {
      value: "universal",
      label: "Universal (Claude)",
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

  // ✅ NEW: API Functions for Subcategories
  const fetchSubcategories = useCallback(async () => {
    try {
      setLoadingSubcategories(true);
      console.log("🔄 ProjectManagement: Fetching subcategories from API...");

      const response = await fetch("/api/subcategories");
      const data = await response.json();

      if (data.success) {
        setSubcategories(data.subcategories);
        console.log(
          `📊 ProjectManagement: Loaded ${data.subcategories.length} subcategories from API`
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
        await fetchProjects();
        showNotification("success", "Success!", data.message);
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
        return data.content;
      } else {
        showNotification(
          "error",
          "Load Failed",
          "Could not load project content."
        );
        return "";
      }
    } catch (error) {
      console.error("Error loading project content:", error);
      showNotification("error", "Network Error", "Failed to load content.");
      return "";
    }
  };

  // ✅ Load data on mount
  useEffect(() => {
    fetchProjects();
    fetchSubcategories();
  }, []);

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
      instructions: "",
      category: "google-ads",
      subcategory: firstSubcat?.value || "",
      targetModel: "universal",
      instructionType: "system",
      status: "active",
    });
    setIsFormOpen(true);
  };

  const handleEdit = async (project: Project) => {
    setEditingProject(project);
    const content = await loadProjectContent(project.filename);
    setFormData({
      name: project.project,
      instructions: content,
      category: project.category,
      subcategory: project.subcategory,
      targetModel: project.targetModel,
      instructionType: project.instructionType,
      status: project.status,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const result = await saveProject(formData);
    if (result.success) {
      setIsFormOpen(false);
      setEditingProject(null);
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
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                Instruction Management
              </h1>
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
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "projects"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Instruction Projects</span>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {projects.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("subcategories")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "subcategories"
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
                        Project
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Category
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Model
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Type
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Status
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Updated
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredProjects.map((project) => {
                      const parentCat = getParentCategoryData(project.category);
                      const childCat = getSubcategoryData(
                        project.category,
                        project.subcategory
                      );
                      const ParentIcon = parentCat?.icon;
                      const ModelOption = modelOptions.find(
                        (m) => m.value === project.targetModel
                      );
                      const InstructionTypeOption = instructionTypeOptions.find(
                        (t) => t.value === project.instructionType
                      );

                      return (
                        <tr
                          key={project.filename}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Project Name */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <div
                                className={`p-2 rounded-lg ${parentCat?.color}`}
                              >
                                {ParentIcon && (
                                  <ParentIcon className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 text-sm">
                                  {project.project}
                                </h3>
                                <div className="text-xs text-gray-500 font-mono">
                                  {project.filename}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-4 px-6">
                            <div className="text-sm font-medium text-gray-900">
                              {parentCat?.label}
                            </div>
                            <div className="text-xs text-gray-500">
                              {childCat?.label || project.subcategory}
                            </div>
                          </td>

                          {/* Model */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              {ModelOption?.icon && (
                                <ModelOption.icon className="w-4 h-4" />
                              )}
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getModelStyle(
                                  project.targetModel
                                )}`}
                              >
                                {ModelOption?.label || project.targetModel}
                              </span>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              {InstructionTypeOption?.icon && (
                                <InstructionTypeOption.icon className="w-4 h-4" />
                              )}
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getInstructionTypeStyle(
                                  project.instructionType
                                )}`}
                              >
                                {InstructionTypeOption?.label ||
                                  project.instructionType}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6">
                            <button
                              onClick={() => handleStatusToggle(project)}
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(
                                project.status
                              )} hover:opacity-80 transition-opacity`}
                            >
                              {project.status.charAt(0).toUpperCase() +
                                project.status.slice(1)}
                            </button>
                          </td>

                          {/* Updated */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-1 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>{getTimeAgo(project.lastModified)}</span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() =>
                                  copyToClipboard(project.filename, "Filename")
                                }
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Copy filename"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(project)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit project"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(project)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Empty State */}
              {filteredProjects.length === 0 && (
                <div className="text-center py-16">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No projects found
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {searchTerm ||
                    filterCategory !== "all" ||
                    filterStatus !== "all"
                      ? "Try adjusting your search criteria or filters"
                      : "Get started by creating your first instruction project"}
                  </p>
                  {!searchTerm &&
                    filterCategory === "all" &&
                    filterStatus === "all" && (
                      <button
                        onClick={handleCreateNew}
                        className="inline-flex items-center space-x-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Create First Project</span>
                      </button>
                    )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ✅ NEW: Subcategories Tab */}
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
                  <button
                    onClick={handleCreateNewSubcategory}
                    className="inline-flex items-center space-x-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    <span>New Subcategory</span>
                  </button>
                </div>

                {/* Filters */}
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
                    {filteredSubcategories.length} subcategories shown
                  </div>
                </div>
              </div>
            </div>

            {/* Subcategories Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Subcategory
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Parent Category
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Status
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Updated
                      </th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredSubcategories.map((subcategory) => {
                      const parentCat = getParentCategoryData(
                        subcategory.category
                      );
                      const ParentIcon = parentCat?.icon;

                      return (
                        <tr
                          key={subcategory.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
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
                              <div
                                className={`p-1.5 rounded-lg ${parentCat?.color}`}
                              >
                                {ParentIcon && (
                                  <ParentIcon className="w-4 h-4" />
                                )}
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {parentCat?.label}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6">
                            <button
                              onClick={() =>
                                handleSubcategoryStatusToggle(subcategory)
                              }
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
                              <span>
                                {getTimeAgo(subcategory.lastModified)}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    subcategory.value,
                                    "Subcategory value"
                                  )
                                }
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Copy value"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleEditSubcategory(subcategory)
                                }
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit subcategory"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteSubcategory(subcategory)
                                }
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete subcategory"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Empty State for Subcategories */}
              {filteredSubcategories.length === 0 && (
                <div className="text-center py-16">
                  <Tags className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No subcategories found
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {subcategorySearchTerm ||
                    subcategoryFilterCategory !== "all"
                      ? "Try adjusting your search criteria or filters"
                      : "Get started by creating your first subcategory"}
                  </p>
                  {!subcategorySearchTerm &&
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Subcategory
                        </label>
                        <select
                          value={formData.subcategory}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              subcategory: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500"
                        >
                          <option value="">Select subcategory...</option>
                          {getActiveSubcategoriesForCategory(
                            formData.category
                          ).map((child) => (
                            <option key={child.id} value={child.value}>
                              {child.label}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-gray-500 mt-1">
                          {getActiveSubcategoriesForCategory(formData.category)
                            .length === 0 && (
                            <span className="text-orange-600">
                              No active subcategories found. Please create one
                              first.
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
                                setFormData({
                                  ...formData,
                                  instructionType: type.value,
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
                  onClick={() => setIsFormOpen(false)}
                  className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    !formData.name.trim() ||
                    !formData.instructions.trim() ||
                    saving
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
                      <span>
                        {editingProject ? "Update Project" : "Create Project"}
                      </span>
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
