import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./AuthIcons.jsx";

// Labelled input with a leading icon; password fields get a show/hide button
const AuthField = ({ id, label, type = "text", icon, ...inputProps }) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-field__control">
        <span className="auth-field__icon">{icon}</span>
        <input
          id={id}
          name={id}
          type={isPassword && revealed ? "text" : type}
          className={isPassword ? "has-reveal" : undefined}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            className="auth-field__reveal"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthField;
