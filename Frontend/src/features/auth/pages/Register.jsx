import React, { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router";
import { useAuth } from "../hooks/useAuth";
import AuthLayout from "../components/AuthLayout.jsx";
import AuthField from "../components/AuthField.jsx";
import { UserIcon, MailIcon, LockIcon, ArrowIcon, AlertIcon } from "../components/AuthIcons.jsx";
import { usePageTitle } from "../../../hooks/usePageTitle.js";

const Register = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Local flag so the button only shows "busy" for the user's own submit,
  // not while the app checks for an existing session on first load
  const [submitting, setSubmitting] = useState(false);

  const { loading, user, handleRegister } = useAuth();
  usePageTitle("Create account · Gapwise");

  if (!loading && user) {
    return <Navigate to="/workspace" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await handleRegister({ username, email, password });
      navigate("/workspace");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={<>Make your next move <em>clearer.</em></>}
      lede="Start a personal career workspace for insights, prep, and momentum."
    >
      <div className="auth-card">
        <div className="auth-card__header">
          <h2>Open a new workspace</h2>
          <p>Create your account and turn your experience into a practical plan.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <AuthField
            id="username"
            label="Username"
            icon={<UserIcon />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a display name"
            autoComplete="username"
            required
          />
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
            placeholder="Create a password"
            autoComplete="new-password"
            required
          />

          {error && <p className="auth-error" role="alert"><AlertIcon /> {error}</p>}

          <button className="auth-submit" disabled={submitting}>
            {submitting ? <span className="auth-spinner" /> : null}
            {submitting ? "Creating your workspace…" : "Create workspace"}
            {!submitting && <ArrowIcon />}
          </button>
        </form>

        <p className="auth-card__switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;
