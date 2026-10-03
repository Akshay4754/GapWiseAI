const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const MailIcon = () => <svg {...svgProps}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg>;
export const LockIcon = () => <svg {...svgProps}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>;
export const UserIcon = () => <svg {...svgProps}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></svg>;
export const EyeIcon = () => <svg {...svgProps}><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
export const EyeOffIcon = () => <svg {...svgProps}><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.4 3.3M6.6 6.6A16.6 16.6 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></svg>;
export const ArrowIcon = () => <svg {...svgProps}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
export const AlertIcon = () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5M12 16h.01" /></svg>;
export const TargetIcon = () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
export const GapIcon = () => <svg {...svgProps}><path d="M5 19V13M12 19V8M19 19V4" /></svg>;
export const PlanIcon = () => <svg {...svgProps}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" /></svg>;
