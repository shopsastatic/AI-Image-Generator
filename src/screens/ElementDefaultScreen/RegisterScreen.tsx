import React, { useState } from "react";
import { API_ENDPOINTS } from "../../utils/apiConfig";
import "./RegisterScreen.css";

interface RegisterScreenProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onRegisterSuccess,
  onSwitchToLogin,
}) => {
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Focus states
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isUserNameFocused, setIsUserNameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [isFullNameFocused, setIsFullNameFocused] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    // Password phải có ít nhất 6 ký tự
    return password.length >= 6;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!email.trim() || !userName.trim() || !password || !confirmPassword) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (!validateEmail(email)) {
      setError("Email không hợp lệ");
      return;
    }

    if (!validatePassword(password)) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.AUTH_REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          user_name: userName.trim(),
          password: password,
          full_name: fullName.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ Registration successful");
        setSuccess("Đăng ký thành công! Đang chuyển đến trang đăng nhập...");

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
            <strong>✅ Đăng ký thành công</strong><br>
            Chào mừng bạn!
          </div>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
          if (notification.parentElement) {
            document.body.removeChild(notification);
          }
        }, 2000);

        // Redirect to login after delay
        setTimeout(() => {
          onSwitchToLogin();
        }, 2000);
      } else {
        setError(data.error || "Đăng ký thất bại. Vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-root">
        <div className="register-icon">
          <svg width="32" height="32" fill="black" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"></path>
          </svg>
        </div>

        <div className="register-title-block">
          <span className="register-heading">Tạo tài khoản mới</span>
          <span className="register-subheading">
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="register-switch-link"
            >
              Đăng nhập
            </button>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="register-form" noValidate>
          <div className="register-fields">
            <div className="register-field-group">
              {/* Email Field */}
              <div className="register-field-container">
                <div
                  className={`register-field-footprint ${
                    isEmailFocused || email ? "focused" : ""
                  }`}
                >
                  <label className="register-typeable-label">
                    <div className="register-label-positioner">
                      <div className="register-label-text">Email</div>
                    </div>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    placeholder="email@example.com"
                    className="register-input"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Username Field */}
              <div className="register-field-container">
                <div
                  className={`register-field-footprint ${
                    isUserNameFocused || userName ? "focused" : ""
                  }`}
                >
                  <label className="register-typeable-label">
                    <div className="register-label-positioner">
                      <div className="register-label-text">Username</div>
                    </div>
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onFocus={() => setIsUserNameFocused(true)}
                    onBlur={() => setIsUserNameFocused(false)}
                    placeholder="Tên đăng nhập"
                    className="register-input"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Full Name Field (Optional) */}
              <div className="register-field-container">
                <div
                  className={`register-field-footprint ${
                    isFullNameFocused || fullName ? "focused" : ""
                  }`}
                >
                  <label className="register-typeable-label">
                    <div className="register-label-positioner">
                      <div className="register-label-text">Họ và tên (tùy chọn)</div>
                    </div>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onFocus={() => setIsFullNameFocused(true)}
                    onBlur={() => setIsFullNameFocused(false)}
                    placeholder="Nguyễn Văn A"
                    className="register-input"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="register-field-container">
                <div
                  className={`register-field-footprint ${
                    isPasswordFocused || password ? "focused" : ""
                  }`}
                >
                  <label className="register-typeable-label">
                    <div className="register-label-positioner">
                      <div className="register-label-text">Mật khẩu</div>
                    </div>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    placeholder="Ít nhất 6 ký tự"
                    className="register-input"
                    autoComplete="new-password"
                    required
                  />
                  <div className="register-end-decoration">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="register-toggle-visibility"
                      aria-label={
                        showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
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

              {/* Confirm Password Field */}
              <div className="register-field-container">
                <div
                  className={`register-field-footprint ${
                    isConfirmPasswordFocused || confirmPassword ? "focused" : ""
                  }`}
                >
                  <label className="register-typeable-label">
                    <div className="register-label-positioner">
                      <div className="register-label-text">Xác nhận mật khẩu</div>
                    </div>
                  </label>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setIsConfirmPasswordFocused(true)}
                    onBlur={() => setIsConfirmPasswordFocused(false)}
                    placeholder="Nhập lại mật khẩu"
                    className="register-input"
                    autoComplete="new-password"
                    required
                  />
                  <div className="register-end-decoration">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="register-toggle-visibility"
                      aria-label={
                        showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                      }
                    >
                      {showConfirmPassword ? (
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
            <div className="register-error">
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

          {/* Success Display */}
          {success && (
            <div className="register-success">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              {success}
            </div>
          )}

          {/* Submit Button */}
          <div className="register-ctas">
            <button
              type="submit"
              disabled={
                isLoading ||
                !email.trim() ||
                !userName.trim() ||
                !password ||
                !confirmPassword
              }
              className={`register-button ${isLoading ? "loading" : ""}`}
            >
              {isLoading ? (
                <div className="register-loading-spinner"></div>
              ) : (
                "Đăng ký"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterScreen;