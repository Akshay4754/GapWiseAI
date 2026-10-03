import { Link } from "react-router";
import "./brand-logo.scss";

const DEPTH_LAYERS = 6;

// 3D mark: an extruded tile carrying an open "G" with a spark in the gap,
// floating and slowly turning, with a particle orbiting around it.
const BrandLogo = ({ to = "/", className = "" }) => (
  <Link className={`brand-logo ${className}`.trim()} to={to} aria-label="Gapwise home">
    <span className="brand-logo__scene" aria-hidden="true">
      <span className="brand-logo__shadow" />
      <span className="brand-logo__mark">
        {Array.from({ length: DEPTH_LAYERS }, (_, i) => (
          <span className="brand-logo__layer" style={{ "--i": i + 1 }} key={i} />
        ))}
        <span className="brand-logo__face" />
        <svg className="brand-logo__glyph" viewBox="0 0 40 40">
          <path className="brand-logo__arc" pathLength="100" d="M27.07 12.93A10 10 0 1 0 30 20h-8" />
        </svg>
        <svg className="brand-logo__glyph brand-logo__glyph--spark" viewBox="0 0 40 40">
          <path
            className="brand-logo__spark"
            d="M30.5 5.2 31.7 8.3 34.8 9.5 31.7 10.7 30.5 13.8 29.3 10.7 26.2 9.5 29.3 8.3Z"
          />
        </svg>
        <span className="brand-logo__orbit">
          <span className="brand-logo__particle" />
        </span>
      </span>
    </span>
    <span className="brand-logo__word">
      <span className="brand-logo__gap">gap</span>
      <span className="brand-logo__wise">wise</span>
      <span className="brand-logo__dot" />
    </span>
  </Link>
);

export default BrandLogo;
