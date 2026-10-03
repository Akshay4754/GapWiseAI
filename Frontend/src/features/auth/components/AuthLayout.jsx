import BrandLogo from "../../../components/BrandLogo.jsx";
import ThemeToggle from "../../../components/ThemeToggle.jsx";
import { TargetIcon, GapIcon, PlanIcon } from "./AuthIcons.jsx";
import "../auth.form.scss";

const BENEFITS = [
  { title: "Match score", text: "See how your resume lines up with the role you want.", Icon: TargetIcon },
  { title: "Skill gaps", text: "Know exactly what to strengthen first.", Icon: GapIcon },
  { title: "Preparation plan", text: "A day-by-day plan plus the questions you're likely to face.", Icon: PlanIcon },
];

// Shared two-panel shell for the sign-in and sign-up pages
const AuthLayout = ({ title, lede, children }) => (
  <main className="auth-shell">
    <div className="auth-shell__ambient" aria-hidden="true" />
    <div className="auth-shell__grid" aria-hidden="true" />
    <ThemeToggle className="theme-toggle--floating" />

    <section className="auth-shell__panel auth-shell__panel--intel">
      <div className="auth-intel">
        <BrandLogo />

        <div className="auth-intel__body">
          <h1>{title}</h1>
          <p className="auth-intel__lede">{lede}</p>

          <ul className="auth-benefits">
            {BENEFITS.map(({ title: name, text, Icon }, i) => (
              <li key={name} style={{ "--i": i }}>
                <span className="auth-benefits__icon">{Icon()}</span>
                <span>
                  <strong>{name}</strong>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-intel__foot">© {new Date().getFullYear()} Gapwise · Built for your next chapter</p>
      </div>
    </section>

    <section className="auth-shell__panel auth-shell__panel--form">
      {children}
    </section>
  </main>
);

export default AuthLayout;
