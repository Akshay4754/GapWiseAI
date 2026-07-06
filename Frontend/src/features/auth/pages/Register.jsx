import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import "../auth.form.scss";
import { useAuth } from "../hooks/useAuth";

const Register = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { loading, handleRegister } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await handleRegister({ username, email, password });
      navigate("/");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-shell__ambient" />
      <div className="auth-shell__grid" />

      <section className="auth-shell__panel auth-shell__panel--intel">
        <div className="auth-intel">
          <p className="auth-kicker">Identity Provisioning</p>
          <h1>Open your workspace.</h1>
          <p className="auth-intel__lede">
            Create a private AI workspace for reports, resumes, and PDF analysis.
          </p>

          <div className="auth-tags">
            <span>Fast Setup</span>
            <span>Private Sessions</span>
            <span>Focused Prep</span>
          </div>
        </div>
      </section>

      <section className="auth-shell__panel auth-shell__panel--form">
        <div className="auth-card">
          <div className="auth-card__header">
            <p className="auth-kicker">Create Access</p>
            <h2>Open a new workspace</h2>
            <p>
              Set up your identity and start running secure interview analysis.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                }}
                type="text"
                id="username"
                name="username"
                placeholder="Choose operator name"
              />
            </div>

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
                placeholder="Set secure passphrase"
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button className="button primary-button auth-button" disabled={loading}>
              {loading ? "Provisioning..." : "Create Workspace"}
            </button>
          </form>

          <div className="auth-card__footer">
            <span>Already active?</span>
            <Link to="/login">Return to sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Register;
