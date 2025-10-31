import React, { useState, useEffect } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { ElementDefault } from "./screens/ElementDefault";
import { ElementDefaultScreen } from "./screens/ElementDefaultScreen";
import { ElementDefaultWrapper } from "./screens/ElementDefaultWrapper";
import { ElementWDefault } from "./screens/ElementWDefault";
import { ElementWDefaultWrapper } from "./screens/ElementWDefaultWrapper";
import ProjectManagement from "./screens/ElementDefaultScreen/ProjectManagement";
import LoginScreen from "./screens/ElementDefaultScreen/LoginScreen";
import RegisterScreen from "./screens/ElementDefaultScreen/RegisterScreen";
import { API_ENDPOINTS } from "./utils/apiConfig";

// ✅ User interface matching backend roles
interface User {
  email: string;
  role: "Admin" | "Marketing" | "Designer" | "Video Editor" | "Content";
  fullName?: string;
  id?: string;
}

// ✅ Loading Component
const LoadingScreen: React.FC = () => (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#f9f9f9",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }}>
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
    }}>
      <div style={{
        width: "40px",
        height: "40px",
        border: "4px solid #e3e3e3",
        borderTop: "4px solid #10a37f",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }} />
      <div style={{ color: "#5d5d5d", fontSize: "14px" }}>
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

// ✅ Access Denied Component
const AccessDenied: React.FC = () => (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#f9f9f9",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <div style={{
      backgroundColor: "white",
      padding: "40px",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      textAlign: "center",
      maxWidth: "400px"
    }}>
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
      <h2 style={{
        color: "#d73027",
        marginBottom: "12px",
        fontSize: "20px"
      }}>
        Access Denied
      </h2>
      <p style={{
        color: "#666",
        marginBottom: "24px",
        lineHeight: "1.5"
      }}>
        You need admin privileges to access this page.
        <br />
        Please contact an administrator.
      </p>
      <button
        onClick={() => window.location.href = "/"}
        style={{
          padding: "10px 20px",
          backgroundColor: "#10a37f",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px"
        }}
      >
        Go to Home
      </button>
    </div>
  </div>
);

// ✅ Protected Route Component
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  adminOnly?: boolean;
  user: User | null;
}> = ({ children, adminOnly = false, user }) => {
  if (adminOnly && user?.role !== "Admin") {
    return <AccessDenied />;
  }
  return <>{children}</>;
};

// ✅ Create Router with User Context
const createRouterWithUser = (user: User | null) =>
  createBrowserRouter([
    {
      path: "/project-management",
      element: (
        <ProtectedRoute user={user}>
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

// ✅ Main App Component
export const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [showRegister, setShowRegister] = useState<boolean>(false);

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
        if (data.success && data.user) {
          setIsAuthenticated(true);
          setUser(data.user);
          console.log("✅ Authenticated:", data.user.email, `(${data.user.role})`);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ✅ CHANGE: Receive user data from LoginScreen
  const handleLoginSuccess = (userData: User) => {
    console.log("✅ Login success with user data:", userData);
    setIsAuthenticated(true);
    setUser(userData);
    setShowRegister(false);
    // No need to call checkAuthStatus() again!
  };

  // Loading state
  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  // Not authenticated - show login or register
  if (!isAuthenticated) {
    if (showRegister) {
      return (
        <RegisterScreen
          onSuccess={() => setShowRegister(false)}
          onBack={() => setShowRegister(false)}
        />
      );
    }
    
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess} // ✅ Now receives user data
        onShowRegister={() => setShowRegister(true)}
      />
    );
  }

  // Authenticated - show main app
  const router = createRouterWithUser(user);
  return <RouterProvider router={router} />;
};