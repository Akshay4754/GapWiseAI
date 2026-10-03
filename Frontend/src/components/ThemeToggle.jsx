import { useState } from "react";
import { flushSync } from "react-dom";
import "./theme-toggle.scss";

const STORAGE_KEY = "gapwise-theme";

const currentTheme = () =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const ThemeToggle = ({ className = "" }) => {
  const [theme, setTheme] = useState(currentTheme);
  const isDark = theme === "dark";

  const apply = (next) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
    setTheme(next);
  };

  const toggle = (event) => {
    const next = isDark ? "light" : "dark";
    const root = document.documentElement;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(next);
      return;
    }

    // Fallback: cross-fade colours for browsers without View Transitions
    if (!document.startViewTransition) {
      root.classList.add("theme-switching");
      apply(next);
      window.setTimeout(() => root.classList.remove("theme-switching"), 450);
      return;
    }

    // Circular reveal expanding from the button
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => {
      flushSync(() => apply(next));
    });

    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 650, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  };

  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      className={`theme-toggle${isDark ? " is-dark" : ""} ${className}`.trim()}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <svg className="theme-toggle__sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <g className="theme-toggle__rays">
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </g>
      </svg>
      <svg className="theme-toggle__moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
        <path className="theme-toggle__star" d="m17.5 4 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L15.5 6l1.5-.5L17.5 4Z" />
      </svg>
    </button>
  );
};

export default ThemeToggle;
