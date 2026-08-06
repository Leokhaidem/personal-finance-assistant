import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Wallet, Lock, Mail, AlertCircle, Eye, EyeOff } from "lucide-react";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          (!err.response || err.code === "ERR_NETWORK"
            ? "Unable to reach backend server. Please ensure backend is running on http://127.0.0.1:8000"
            : "Invalid email or password."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top right, rgba(99,102,241,0.15), transparent 50%), var(--bg-primary)",
        padding: "clamp(1rem, 4vw, 2rem)",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "clamp(1.5rem, 5vw, 2.5rem)",
          borderRadius: "18px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "linear-gradient(135deg, #6366f1, #ec4899)",
              padding: "0.85rem",
              borderRadius: "16px",
              marginBottom: "1rem",
            }}
          >
            <Wallet size={30} color="#fff" />
          </div>

          <h2
            style={{
              marginBottom: "0.4rem",
              fontWeight: "700",
            }}
          >
            Welcome Back 👋
          </h2>

          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
          >
            Sign in to your Personal Finance Assistant
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "var(--accent-danger)",
              padding: "0.8rem",
              borderRadius: "10px",
              marginBottom: "1.4rem",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.3rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.45rem",
                color: "var(--text-secondary)",
              }}
            >
              Email Address
            </label>

            <div style={{ position: "relative" }}>
              <Mail
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />

              <input
                type="email"
                className="input-field"
                style={{
                  paddingLeft: "2.6rem",
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "1.7rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.45rem",
                color: "var(--text-secondary)",
              }}
            >
              Password
            </label>

            <div style={{ position: "relative" }}>
              <Lock
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />

              <input
                type={showPassword ? "text" : "password"}
                className="input-field"
                style={{
                  paddingLeft: "2.6rem",
                  paddingRight: "2.6rem",
                }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px",
                }}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "0.9rem",
              transition: "all 0.25s ease",
            }}
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div
          style={{
            marginTop: "1.6rem",
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          <br />
          New here?{" "}
          <Link
            to="/register"
            style={{
              color: "var(--accent-primary)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};
