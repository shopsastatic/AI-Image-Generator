import React, { useState, useEffect } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { ElementDefault } from "./screens/ElementDefault";
import { ElementDefaultScreen } from "./screens/ElementDefaultScreen";
import { ElementDefaultWrapper } from "./screens/ElementDefaultWrapper";
import { ElementWDefault } from "./screens/ElementWDefault";
import { ElementWDefaultWrapper } from "./screens/ElementWDefaultWrapper";
import ProjectManagement from "./screens/ElementDefaultScreen/ProjectManagement";
import LoginScreen from "./screens/ElementDefaultScreen/LoginScreen";
import { API_ENDPOINTS } from "./utils/apiConfig";

// ✅ NEW: User interface with role
interface User {
  email: string;
  role: 'user' | 'admin';
  loginTime: number;
}

// ✅ UPDATED: ProtectedRoute with role-based access
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  adminOnly?: boolean;
  user?: User | null;
}> = ({ children, adminOnly = false, user }) => {
  
  // ✅ NEW: Admin-only route protection
  if (adminOnly && user?.role !== 'admin') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f9f9f9',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🔐</div>
          <h2 style={{
            color: '#d73027',
            marginBottom: '12px',
            fontSize: '20px'
          }}>Access Denied</h2>
          <p style={{
            color: '#666',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>
            You need admin privileges to access this page.
            <br />
            Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return <div>{children}</div>;
};

// ✅ UPDATED: Router with role-based protection
const createRouterWithUser = (user: User | null) => createBrowserRouter([
  {
    path: "/project-management",
    element: (
      <ProtectedRoute adminOnly={true} user={user}>
        <ProjectManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: "/1920w-default",
    element: (
      <ProtectedRoute user={user}>
        <ElementDefaultScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: "/390w-default",
    element: (
      <ProtectedRoute user={user}>
        <ElementDefault />
      </ProtectedRoute>
    ),
  },
  {
    path: "/1440w-default",
    element: (
      <ProtectedRoute user={user}>
        <ElementWDefault />
      </ProtectedRoute>
    ),
  },
  {
    path: "/1024w-default",
    element: (
      <ProtectedRoute user={user}>
        <ElementDefaultWrapper />
      </ProtectedRoute>
    ),
  },
  {
    path: "/768w-default",
    element: (
      <ProtectedRoute user={user}>
        <ElementWDefaultWrapper />
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute user={user}>
        <ElementDefaultScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: (
      <ProtectedRoute user={user}>
        <ElementDefaultScreen />
      </ProtectedRoute>
    ),
  },
]);

export const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null); // ✅ NEW: Store user info

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH_VERIFY, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        setUser(data.user); // ✅ NEW: Store user data with role
        console.log('✅ Authenticated as:', data.user.email, '(' + data.user.role + ')');
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // Re-check auth to get user role
    checkAuthStatus();
  };

  if (isAuthLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#f9f9f9",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e3e3e3",
              borderTop: "4px solid #10a37f",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <div
            style={{
              color: "#5d5d5d",
              fontSize: "14px",
            }}
          >
            Checking authentication...
          </div>
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // ✅ NEW: Create router with user role info
  const router = createRouterWithUser(user);

  return <RouterProvider router={router} />;
};