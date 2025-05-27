import React, { useState, useEffect } from "react";
import { API_ENDPOINTS } from "../../utils/apiConfig";
import "./LoginScreen.css";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Check if already logged in on component mount
  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH_VERIFY, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        console.log("✅ Already authenticated");
        onLoginSuccess();
      }
    } catch (error) {
      console.log("🔐 Authentication required");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(API_ENDPOINTS.AUTH_LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ Login successful");

        // Show success notification
        const notification = document.createElement("div");
        notification.innerHTML = `
          <div style="
            position: fixed; 
            top: 20px; 
            right: 20px; 
            background: #10a37f; 
            color: white; 
            padding: 15px 20px; 
            border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <strong>✅ Login Successful</strong><br>
            Welcome back!
          </div>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
          if (notification.parentElement) {
            document.body.removeChild(notification);
          }
        }, 2000);

        // Redirect after short delay
        setTimeout(() => {
          onLoginSuccess();
        }, 1000);
      } else {
        setError(data.error || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-root">
        <div className="login-icon">
          <svg width="32" height="32" fill="black" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM7.07 18.28c.43-.9 3.05-1.78 4.93-1.78s4.51.88 4.93 1.78C15.57 19.36 13.86 20 12 20s-3.57-.64-4.93-1.72zm11.29-1.45c-1.43-1.74-4.9-2.33-6.36-2.33s-4.93.59-6.36 2.33C4.62 15.49 4 13.82 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 1.82-.62 3.49-1.64 4.83zM12 6c-1.94 0-3.5 1.56-3.5 3.5S10.06 13 12 13s3.5-1.56 3.5-3.5S13.94 6 12 6zm0 5c-.83 0-1.5-.67-1.5-1.5S11.17 8 12 8s1.5.67 1.5 1.5S12.83 11 12 11z"></path>
          </svg>
        </div>

        <div className="login-title-block">
          <span className="login-heading">Please login to continue</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-fields">
            <div className="login-field-group">
              {/* Email Field */}
              <div className="login-field-container">
                <div
                  className={`login-field-footprint ${
                    isEmailFocused || email ? "focused" : ""
                  }`}
                >
                  <label className="login-typeable-label">
                    <div className="login-label-positioner">
                      <div className="login-label-text">Username</div>
                    </div>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    placeholder="Email address"
                    className="login-input"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="login-field-container">
                <div
                  className={`login-field-footprint ${
                    isPasswordFocused || password ? "focused" : ""
                  }`}
                >
                  <label className="login-typeable-label">
                    <div className="login-label-positioner">
                      <div className="login-label-text">Password</div>
                    </div>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    placeholder="Password"
                    className="login-input"
                    autoComplete="current-password"
                    required
                  />
                  <div className="login-end-decoration">
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="login-toggle-visibility"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M3.707 2.293a1 1 0 0 0-1.414 1.414l18 18a1 1 0 0 0 1.414-1.414L19.82 18.406c1.108-.88 2.047-1.966 2.715-3.135.414-.724.414-1.618 0-2.342-1.17-2.044-3.306-4.93-6.535-6.93C13.736 4.43 11.07 4 8.5 4c-1.267 0-2.482.162-3.614.459L3.707 2.293zM6.084 5.877c.822-.226 1.73-.377 2.916-.377 2.93 0 5.596.57 7.5 2 1.596 1.2 3.403 3.315 4.314 5C19.966 13.445 18.714 14.9 17.1 16.1l-1.414-1.414c.918-.736 1.71-1.612 2.298-2.586-.814-1.35-2.118-2.9-3.484-3.9C12.596 6.57 10.43 6 8.5 6c-.57 0-1.116.043-1.63.123L6.084 5.877z"
                            fill="currentColor"
                          />
                          <path
                            d="M12 10a2 2 0 0 1 2 2c0 .36-.097.7-.266.99l-2.724-2.724c.29-.169.63-.266.99-.266z"
                            fill="currentColor"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M5.91444 7.59106C4.3419 9.04124 3.28865 10.7415 2.77052 11.6971C2.66585 11.8902 2.66585 12.1098 2.77052 12.3029C3.28865 13.2585 4.3419 14.9588 5.91444 16.4089C7.48195 17.8545 9.50572 19 12 19C14.4943 19 16.518 17.8545 18.0855 16.4089C19.6581 14.9588 20.7113 13.2585 21.2295 12.3029C21.3341 12.1098 21.3341 11.8902 21.2295 11.6971C20.7113 10.7415 19.6581 9.04124 18.0855 7.59105C16.518 6.1455 14.4943 5 12 5C9.50572 5 7.48195 6.1455 5.91444 7.59106ZM4.55857 6.1208C6.36059 4.45899 8.84581 3 12 3C15.1542 3 17.6394 4.45899 19.4414 6.1208C21.2384 7.77798 22.4152 9.68799 22.9877 10.7438C23.4147 11.5315 23.4147 12.4685 22.9877 13.2562C22.4152 14.312 21.2384 16.222 19.4414 17.8792C17.6394 19.541 15.1542 21 12 21C8.84581 21 6.36059 19.541 4.55857 17.8792C2.76159 16.222 1.58478 14.312 1.01232 13.2562C0.58525 12.4685 0.585249 11.5315 1.01232 10.7438C1.58478 9.688 2.76159 7.77798 4.55857 6.1208ZM12 9.5C10.6193 9.5 9.49999 10.6193 9.49999 12C9.49999 13.3807 10.6193 14.5 12 14.5C13.3807 14.5 14.5 13.3807 14.5 12C14.5 10.6193 13.3807 9.5 12 9.5ZM7.49999 12C7.49999 9.51472 9.51471 7.5 12 7.5C14.4853 7.5 16.5 9.51472 16.5 12C16.5 14.4853 14.4853 16.5 12 16.5C9.51471 16.5 7.49999 14.4853 7.49999 12Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="login-error">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l2-8 2 8h-4zm2-10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="login-ctas">
            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password}
              className={`login-button ${isLoading ? "loading" : ""}`}
            >
              {isLoading ? (
                <div className="login-loading-spinner"></div>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
