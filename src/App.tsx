import React, { useState, useEffect } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { ElementDefault } from "./screens/ElementDefault";
import { ElementDefaultScreen } from "./screens/ElementDefaultScreen";
import { ElementDefaultWrapper } from "./screens/ElementDefaultWrapper";
import { ElementWDefault } from "./screens/ElementWDefault";
import { ElementWDefaultWrapper } from "./screens/ElementWDefaultWrapper";
import LoginScreen from "./screens/ElementDefaultScreen/LoginScreen";
import { API_ENDPOINTS } from "./utils/apiConfig";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div>{children}</div>;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <ElementDefaultScreen />
      </ProtectedRoute>
    ),
  },
  // Sử dụng route cụ thể thay vì wildcard
  {
    path: "/ty",
    element: (
      <ProtectedRoute>
        <ElementDefaultScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: "/1920w-default",
    element: (
      <ProtectedRoute>
        <ElementDefaultScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: "/390w-default",
    element: (
      <ProtectedRoute>
        <ElementDefault />
      </ProtectedRoute>
    ),
  },
  {
    path: "/1440w-default",
    element: (
      <ProtectedRoute>
        <ElementWDefault />
      </ProtectedRoute>
    ),
  },
  {
    path: "/1024w-default",
    element: (
      <ProtectedRoute>
        <ElementDefaultWrapper />
      </ProtectedRoute>
    ),
  },
  {
    path: "/768w-default",
    element: (
      <ProtectedRoute>
        <ElementWDefaultWrapper />
      </ProtectedRoute>
    ),
  },
  // Route 404 - phải đặt cuối cùng
  {
    path: "*",
    element: (
      <ProtectedRoute>
        <ElementDefaultScreen />
      </ProtectedRoute>
    ),
  },
]);

export const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

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
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
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

  return <RouterProvider router={router} />;
};
