// backend/constants/roles.js
export const SYSTEM_ROLES = [
  'Admin',
  'Marketing', 
  'Designer',
  'Video Editor',
  'Content'
];

// ✅ Roles that can be managed (exclude Admin)
export const MANAGEABLE_ROLES = [
  'Marketing', 
  'Designer',
  'Video Editor',
  'Content'
];

export const ROLE_PERMISSIONS = {
  'Admin': {
    canManageProjects: true,
    canManageSubcategories: true,
    canManageRoles: true,
    canViewAll: true
  },
  'Marketing': {
    canManageProjects: false,
    canManageSubcategories: false,
    canManageRoles: false,
    canViewAll: false
  },
  'Designer': {
    canManageProjects: false,
    canManageSubcategories: false,
    canManageRoles: false,
    canViewAll: false
  },
  'Video Editor': {
    canManageProjects: false,
    canManageSubcategories: false,
    canManageRoles: false,
    canViewAll: false
  },
  'Content': {
    canManageProjects: false,
    canManageSubcategories: false,
    canManageRoles: false,
    canViewAll: false
  }
};

export const isValidRole = (role) => {
  return SYSTEM_ROLES.includes(role);
};

export const isManageableRole = (role) => {
  return MANAGEABLE_ROLES.includes(role);
};

export const hasPermission = (userRole, permission) => {
  return ROLE_PERMISSIONS[userRole]?.[permission] || false;
};