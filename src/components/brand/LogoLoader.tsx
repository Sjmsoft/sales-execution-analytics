import BrandLogo3D from "./BrandLogo3D";
import "./brand.css";

export type LogoLoaderVariant = "fullscreen" | "overlay" | "page" | "section" | "inline";

type LogoLoaderProps = {
  /**
   * fullscreen – covers the viewport (app boot / auth)
   * overlay    – covers the main content area (route transitions)
   * page       – fills a page while its first data loads
   * section    – a card / table / panel loading state
   * inline     – compact row for tight spaces
   */
  variant?: LogoLoaderVariant;
  message?: string;
  hint?: string;
  className?: string;
};

const LOGO_SIZE: Record<LogoLoaderVariant, number> = {
  fullscreen: 104,
  overlay: 84,
  page: 88,
  section: 64,
  inline: 30,
};

/** Branded loading indicator that spins the 3D Pen Edge logo. */
export default function LogoLoader({
  variant = "section",
  message = "Loading data",
  hint,
  className = "",
}: LogoLoaderProps) {
  const isDarkSurface = variant === "fullscreen";
  const isInline = variant === "inline";

  return (
    <div
      className={`logo-loader logo-loader--${variant} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="logo-loader-orb">
        {!isInline && <span className="logo-loader-glow" aria-hidden="true" />}
        {!isInline && <span className="logo-loader-ring" aria-hidden="true" />}
        <BrandLogo3D
          size={LOGO_SIZE[variant]}
          motion="spin"
          tone={isDarkSurface ? "dark" : "light"}
          layers={isInline ? 5 : 9}
        />
      </div>

      {variant === "fullscreen" && (
        <div className="logo-loader-wordmark">
          <strong>Pen Edge</strong>
          <span>Sales Execution</span>
        </div>
      )}

      <div className="logo-loader-text">
        <span className="logo-loader-message">
          {message}
          <span className="logo-loader-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
        {hint && !isInline && <span className="logo-loader-hint">{hint}</span>}
      </div>

      {!isInline && (
        <div className="logo-loader-bar" aria-hidden="true">
          <span />
        </div>
      )}
    </div>
  );
}
