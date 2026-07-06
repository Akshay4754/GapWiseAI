import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import "../auth.form.scss";
import { useAuth } from "../hooks/useAuth";

const Login = () => {
  const { loading, handleLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await handleLogin({ email, password });
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-shell__ambient" />
      <div className="auth-shell__grid" />

      <section className="auth-shell__panel auth-shell__panel--intel">
        <div className="auth-intel">
          <p className="auth-kicker">GapWise Security Layer</p>
          <h1>Interview intelligence.</h1>
          <p className="auth-intel__lede">
            Private AI tools for resumes, PDFs, and role prep.
          </p>

          <div className="auth-tags">
            <span>Secure Access</span>
            <span>Resume Analysis</span>
            <span>PDF Q&amp;A</span>
          </div>
        </div>
      </section>

      <section className="auth-shell__panel auth-shell__panel--form">
        <div className="auth-card">
          <div className="auth-card__header">
            <p className="auth-kicker">Access Node</p>
            <h2>Welcome back</h2>
            <p>
              Continue into your interview workspace and secure document tools.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                type="email"
                id="email"
                name="email"
                placeholder="operator@company.com"
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                type="password"
                id="password"
                name="password"
                placeholder="Enter secure passphrase"
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button className="button primary-button auth-button" disabled={loading}>
              {loading ? "Authorizing..." : "Enter Workspace"}
            </button>
          </form>

          <div className="auth-card__footer">
            <span>New operator?</span>
            <Link to="/register">Create secure access</Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
