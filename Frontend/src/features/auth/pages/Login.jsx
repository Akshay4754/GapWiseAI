import React, { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router";
import { useAuth } from "../hooks/useAuth";
import AuthLayout from "../components/AuthLayout.jsx";
import AuthField from "../components/AuthField.jsx";
import { MailIcon, LockIcon, ArrowIcon, AlertIcon } from "../components/AuthIcons.jsx";
import { usePageTitle } from "../../../hooks/usePageTitle.js";

const Login = () => {
  const { loading, user, handleLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Local flag so the button only shows "busy" for the user's own submit,
  // not while the app checks for an existing session on first load
  const [submitting, setSubmitting] = useState(false);
  usePageTitle("Sign in · Gapwise");

  if (!loading && user) {
    return <Navigate to="/workspace" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await handleLogin({ email, password });
      navigate("/workspace");
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={<>Welcome back <em>to clarity.</em></>}
      lede="Pick up your resume insights, focused prep, and next career move."
    >
      <div className="auth-card">
        <div className="auth-card__header">
          <h2>Sign in</h2>
          <p>Continue into your personal career workspace.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <AuthField
            id="email"
            label="Email"
            type="email"
            icon={<MailIcon />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            icon={<LockIcon />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && <p className="auth-error" role="alert"><AlertIcon /> {error}</p>}

          <button className="auth-submit" disabled={submitting}>
            {submitting ? <span className="auth-spinner" /> : null}
            {submitting ? "Signing you in…" : "Enter workspace"}
            {!submitting && <ArrowIcon />}
          </button>
        </form>

        <p className="auth-card__switch">
          New here? <Link to="/register">Create your account</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;
