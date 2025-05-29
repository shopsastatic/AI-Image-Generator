import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Edit2, Save, Trash2, X, Search, Filter, 
  Target, Share2, Globe, Clock, MoreHorizontal, Check
} from 'lucide-react';

const ProjectManagement = () => {
  const [projects, setProjects] = useState([
    {
      id: 1,
      name: 'E-commerce Product Showcase Generator',
      instructions: 'Generate high-converting product showcase images for Google Shopping campaigns. Create lifestyle shots with clean backgrounds, multiple angles, and size variations.',
      parentCategory: 'google-ads',
      childCategory: 'shopping-image-generator',
      status: 'active',
      lastModified: '2024-05-28'
    },
    {
      id: 2,
      name: 'Social Media Brand Story Visuals',
      instructions: 'Create engaging brand storytelling images for Facebook carousel ads. Focus on emotional connection, lifestyle integration, and user-generated content style.',
      parentCategory: 'facebook-ads',
      childCategory: 'carousel-image-generator',
      status: 'active',
      lastModified: '2024-05-27'
    },
    {
      id: 3,
      name: 'Landing Page Hero Image Creator',
      instructions: 'Generate compelling hero images for SaaS landing pages. Include product mockups, benefit illustrations, and professional photography style.',
      parentCategory: 'website-content',
      childCategory: 'hero-image-generator',
      status: 'completed',
      lastModified: '2024-05-25'
    },
    {
      id: 4,
      name: 'Search Campaign Visual Assets',
      instructions: 'Create attention-grabbing visual assets for Google Search campaigns. Generate responsive display ads, promotional banners, and call extension images.',
      parentCategory: 'google-ads',
      childCategory: 'search-visual-generator',
      status: 'active',
      lastModified: '2024-05-29'
    },
    {
      id: 5,
      name: 'Video Thumbnail Generator',
      instructions: 'Design compelling video thumbnails for Facebook video ads. Create high-contrast, emotion-driven thumbnails that increase click-through rates.',
      parentCategory: 'facebook-ads',
      childCategory: 'video-thumbnail-generator',
      status: 'paused',
      lastModified: '2024-05-20'
    },
    {
      id: 6,
      name: 'Advertorial Content Visuals',
      instructions: 'Generate authentic-looking images for advertorial website content. Create before/after comparisons, product demonstrations, and testimonial graphics.',
      parentCategory: 'website-content',
      childCategory: 'advertorial-image-generator',
      status: 'active',
      lastModified: '2024-05-26'
    }
  ]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubcategoryFormOpen, setIsSubcategoryFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [managingCategoryType, setManagingCategoryType] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    label: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    instructions: '',
    parentCategory: 'google-ads',
    childCategory: 'shopping-image-generator',
    status: 'active'
  });

  const parentCategories = [
    { 
      value: 'google-ads', 
      label: 'Google Ads', 
      icon: Target, 
      color: 'bg-blue-50 text-blue-700',
      description: 'Search, Display & Shopping campaigns'
    },
    { 
      value: 'facebook-ads', 
      label: 'Facebook Ads', 
      icon: Share2, 
      color: 'bg-indigo-50 text-indigo-700',
      description: 'Social media advertising campaigns'
    },
    { 
      value: 'website-content', 
      label: 'Website Content', 
      icon: Globe, 
      color: 'bg-green-50 text-green-700',
      description: 'Website visuals & content marketing'
    }
  ];

  const [childCategories, setChildCategories] = useState({
    'google-ads': [
      { value: 'shopping-image-generator', label: 'Shopping Image Generator' },
      { value: 'search-visual-generator', label: 'Search Visual Generator' },
      { value: 'display-banner-generator', label: 'Display Banner Generator' },
      { value: 'retargeting-image-generator', label: 'Retargeting Image Generator' },
      { value: 'youtube-thumbnail-generator', label: 'YouTube Thumbnail Generator' }
    ],
    'facebook-ads': [
      { value: 'carousel-image-generator', label: 'Carousel Image Generator' },
      { value: 'story-template-generator', label: 'Story Template Generator' },
      { value: 'video-thumbnail-generator', label: 'Video Thumbnail Generator' },
      { value: 'lead-form-visual-generator', label: 'Lead Form Visual Generator' },
      { value: 'collection-ad-generator', label: 'Collection Ad Generator' }
    ],
    'website-content': [
      { value: 'hero-image-generator', label: 'Hero Image Generator' },
      { value: 'advertorial-image-generator', label: 'Advertorial Image Generator' },
      { value: 'blog-featured-generator', label: 'Blog Featured Generator' },
      { value: 'product-showcase-generator', label: 'Product Showcase Generator' },
      { value: 'email-header-generator', label: 'Email Header Generator' }
    ]
  });

  const statusOptions = [
    { value: 'active', label: 'Active', color: 'bg-green-50 text-green-700 border-green-200' },
    { value: 'paused', label: 'Paused', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { value: 'completed', label: 'Completed', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'archived', label: 'Archived', color: 'bg-gray-50 text-gray-700 border-gray-200' }
  ];

  // Generate unique value from label
  const generateUniqueValue = (label, categoryType, excludeValue = null) => {
    // Convert to slug format
    const baseSlug = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes

    // Check if base slug exists
    const existingValues = childCategories[categoryType]
      ?.map(cat => cat.value)
      .filter(val => val !== excludeValue) || [];

    let uniqueValue = baseSlug;
    let counter = 1;

    // Keep incrementing until we find a unique value
    while (existingValues.includes(uniqueValue)) {
      uniqueValue = `${baseSlug}-${counter}`;
      counter++;
    }

    return uniqueValue;
  };

  // Time calculation
  const getTimeAgo = (date) => {
    const now = new Date();
    const updatedDate = new Date(date);
    const diffTime = Math.abs(now - updatedDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Filtering and sorting
  const getSortedProjects = (projects) => {
    const statusPriority = { active: 0, paused: 1, completed: 2, archived: 3 };
    
    switch (sortBy) {
      case 'recent':
        return [...projects].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      case 'name':
        return [...projects].sort((a, b) => a.name.localeCompare(b.name));
      case 'status':
        return [...projects].sort((a, b) => {
          const statusDiff = statusPriority[a.status] - statusPriority[b.status];
          if (statusDiff !== 0) return statusDiff;
          return new Date(b.lastModified) - new Date(a.lastModified);
        });
      case 'category':
        return [...projects].sort((a, b) => {
          const catDiff = a.parentCategory.localeCompare(b.parentCategory);
          if (catDiff !== 0) return catDiff;
          return a.childCategory.localeCompare(b.childCategory);
        });
      default:
        return projects;
    }
  };

  const filteredProjects = getSortedProjects(
    projects.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || project.parentCategory === filterCategory;
      const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    })
  );

  // Subcategory Management
  const handleManageSubcategories = (parentCategoryValue) => {
    setManagingCategoryType(parentCategoryValue);
    setIsSubcategoryFormOpen(true);
    setEditingSubcategory(null);
    setSubcategoryFormData({ label: '' });
  };

  const handleEditSubcategory = (subcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryFormData({ label: subcategory.label });
  };

  const handleSaveSubcategory = () => {
    if (!subcategoryFormData.label.trim()) return;

    const newCategories = { ...childCategories };
    
    if (editingSubcategory) {
      // Update existing subcategory
      const generatedValue = generateUniqueValue(
        subcategoryFormData.label, 
        managingCategoryType, 
        editingSubcategory.value
      );
      
      const index = newCategories[managingCategoryType].findIndex(
        cat => cat.value === editingSubcategory.value
      );
      
      if (index !== -1) {
        const updatedSubcategory = {
          value: generatedValue,
          label: subcategoryFormData.label
        };
        
        newCategories[managingCategoryType][index] = updatedSubcategory;
        
        // Update projects that use this subcategory
        setProjects(projects.map(project => 
          project.parentCategory === managingCategoryType && project.childCategory === editingSubcategory.value
            ? { ...project, childCategory: generatedValue, lastModified: new Date().toISOString().split('T')[0] }
            : project
        ));
      }
    } else {
      // Add new subcategory
      const generatedValue = generateUniqueValue(subcategoryFormData.label, managingCategoryType);
      
      newCategories[managingCategoryType].push({
        value: generatedValue,
        label: subcategoryFormData.label
      });
    }
    
    setChildCategories(newCategories);
    setEditingSubcategory(null);
    setSubcategoryFormData({ label: '' });
  };

  const handleDeleteSubcategory = (subcategoryValue) => {
    if (window.confirm('Are you sure you want to delete this subcategory? Projects using this subcategory will be affected.')) {
      const newCategories = { ...childCategories };
      newCategories[managingCategoryType] = newCategories[managingCategoryType].filter(
        cat => cat.value !== subcategoryValue
      );
      setChildCategories(newCategories);
      
      // Update projects that use this subcategory to use the first available one
      const firstAvailable = newCategories[managingCategoryType][0]?.value || '';
      setProjects(projects.map(project => 
        project.parentCategory === managingCategoryType && project.childCategory === subcategoryValue
          ? { ...project, childCategory: firstAvailable, lastModified: new Date().toISOString().split('T')[0] }
          : project
      ));
    }
  };

  // Project Management
  const handleCreateNew = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      instructions: '',
      parentCategory: 'google-ads',
      childCategory: childCategories['google-ads'][0]?.value || '',
      status: 'active'
    });
    setIsFormOpen(true);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({ ...project });
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (editingProject) {
      setProjects(projects.map(p => 
        p.id === editingProject.id 
          ? { ...formData, id: p.id, lastModified: new Date().toISOString().split('T')[0] }
          : p
      ));
    } else {
      const newProject = {
        ...formData,
        id: Math.max(...projects.map(p => p.id)) + 1,
        lastModified: new Date().toISOString().split('T')[0]
      };
      setProjects([...projects, newProject]);
    }
    setIsFormOpen(false);
    setEditingProject(null);
  };

  const handleDelete = (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      setProjects(projects.filter(p => p.id !== projectId));
    }
  };

  const handleParentCategoryChange = (newParent) => {
    const firstChild = childCategories[newParent]?.[0]?.value || '';
    setFormData({
      ...formData,
      parentCategory: newParent,
      childCategory: firstChild
    });
  };

  const getParentCategoryData = (value) => {
    return parentCategories.find(cat => cat.value === value);
  };

  const getChildCategoryData = (parent, child) => {
    return childCategories[parent]?.find(cat => cat.value === child);
  };

  const getStatusStyle = (status) => {
    return statusOptions.find(s => s.value === status)?.color || 'bg-gray-50 text-gray-700';
  };

  // Get preview of generated value
  const getPreviewValue = () => {
    if (!subcategoryFormData.label.trim()) return '';
    
    const excludeValue = editingSubcategory ? editingSubcategory.value : null;
    return generateUniqueValue(subcategoryFormData.label, managingCategoryType, excludeValue);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Image Prompt Projects</h1>
          <p className="text-gray-600">Create and manage AI image generation prompts for marketing campaigns</p>
        </div>

        {/* Enhanced Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative min-w-[300px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent w-full"
                />
              </div>
              
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white min-w-[180px]"
              >
                <option value="all">All Categories</option>
                {parentCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white min-w-[140px]"
              >
                <option value="all">All Status</option>
                {statusOptions.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 bg-white min-w-[160px]"
              >
                <option value="recent">Recently Updated</option>
                <option value="name">Name A-Z</option>
                <option value="status">Status</option>
                <option value="category">Category</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">
                {filteredProjects.length} projects
              </div>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center space-x-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>New Project</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Management Buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Manage Subcategories</h3>
            <div className="flex items-center space-x-2">
              {parentCategories.map(category => (
                <button
                  key={category.value}
                  onClick={() => handleManageSubcategories(category.value)}
                  className="inline-flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  <category.icon className="w-4 h-4" />
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Project</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Category</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Subcategory</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Updated</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProjects.map(project => {
                  const parentCat = getParentCategoryData(project.parentCategory);
                  const childCat = getChildCategoryData(project.parentCategory, project.childCategory);
                  const ParentIcon = parentCat?.icon;
                  
                  return (
                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                      {/* Project Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${parentCat?.color}`}>
                            <ParentIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{project.name}</h3>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-gray-900">{parentCat?.label}</div>
                      </td>

                      {/* Subcategory */}
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700">
                          {childCat?.label || 'Not Set'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(project.status)}`}>
                          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </span>
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
                            onClick={() => handleEdit(project)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? 'Try adjusting your search criteria' : 'Get started by creating your first image prompt project'}
              </p>
            </div>
          )}
        </div>

        {/* Subcategory Management Modal */}
        {isSubcategoryFormOpen && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Manage {parentCategories.find(c => c.value === managingCategoryType)?.label} Subcategories
                </h2>
                <button
                  onClick={() => setIsSubcategoryFormOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {/* Add/Edit Form */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    {editingSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}
                  </h3>
                  
                  {/* Display Label Input */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Display Label</label>
                    <input
                      type="text"
                      value={subcategoryFormData.label}
                      onChange={(e) => setSubcategoryFormData({...subcategoryFormData, label: e.target.value})}
                      placeholder="e.g., Shopping Image Generator"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm"
                    />
                  </div>

                  {/* Auto-generated Value Preview */}
                  {subcategoryFormData.label && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Auto-generated ID</label>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 font-mono">
                        {getPreviewValue()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID is automatically generated from the display label
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSaveSubcategory}
                      disabled={!subcategoryFormData.label.trim()}
                      className="inline-flex items-center space-x-1 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 text-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingSubcategory ? 'Update' : 'Add'}</span>
                    </button>
                    {editingSubcategory && (
                      <button
                        onClick={() => {
                          setEditingSubcategory(null);
                          setSubcategoryFormData({ label: '' });
                        }}
                        className="px-3 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Existing Subcategories */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Existing Subcategories</h3>
                  <div className="space-y-2">
                    {childCategories[managingCategoryType]?.map(subcategory => (
                      <div key={subcategory.value} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{subcategory.label}</div>
                          <div className="text-xs text-gray-500 font-mono">{subcategory.value}</div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEditSubcategory(subcategory)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubcategory(subcategory.value)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )) || <div className="text-gray-500 text-sm">No subcategories yet</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-8 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingProject ? 'Edit Project' : 'Create New Project'}
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
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter descriptive project name..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-4">
                    Project Category *
                  </label>
                  
                  {/* Parent Category Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {parentCategories.map(category => {
                      const Icon = category.icon;
                      const isSelected = formData.parentCategory === category.value;
                      
                      return (
                        <div
                          key={category.value}
                          onClick={() => handleParentCategoryChange(category.value)}
                          className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-gray-800 bg-gray-50 shadow-md' 
                              : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
                          }`}
                        >
                          <div className="flex flex-col items-center text-center space-y-3">
                            <div className={`p-3 rounded-xl ${category.color}`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 mb-1">
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

                  {/* Child Category Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Subcategory
                    </label>
                    <select
                      value={formData.childCategory}
                      onChange={(e) => setFormData({ ...formData, childCategory: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    >
                      {childCategories[formData.parentCategory]?.map(child => (
                        <option key={child.value} value={child.value}>
                          {child.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Project Instructions */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Project Instructions *
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="Describe the image generation requirements, style guidelines, target audience, and specific creative instructions..."
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-vertical"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Project Status
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {statusOptions.map(status => {
                      const isSelected = formData.status === status.value;
                      
                      return (
                        <div
                          key={status.value}
                          onClick={() => setFormData({ ...formData, status: status.value })}
                          className={`p-3 border rounded-lg cursor-pointer transition-all text-center ${
                            isSelected 
                              ? 'border-gray-800 bg-gray-50' 
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
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
                  disabled={!formData.name.trim() || !formData.instructions.trim()}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Save className="w-5 h-5" />
                  <span>{editingProject ? 'Update Project' : 'Create Project'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectManagement;