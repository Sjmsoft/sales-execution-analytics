import type { CSSProperties } from "react";
import "./brand.css";

export type BrandLogoMotion = "sway" | "spin" | "still";
export type BrandLogoTone = "dark" | "light";

type BrandLogo3DProps = {
  /** Rendered width in px (height is ~0.92 × width). */
  size?: number;
  /** "sway" = idle brand float, "spin" = loader rotation, "still" = static 3D pose. */
  motion?: BrandLogoMotion;
  /** "dark" for dark surfaces (sidebar, login), "light" for white/light surfaces. */
  tone?: BrandLogoTone;
  /** Number of extrusion slices — more slices = thicker, smoother edge when rotating. */
  layers?: number;
  className?: string;
  /** Accessible label. When omitted the logo is treated as decorative. */
  label?: string;
};

/**
 * Pen Edge sail-and-keel mark rendered as a true CSS 3D object.
 * Each part is extruded by stacking clipped slices along the Z axis,
 * so it keeps real depth while rotating (no images, scales crisply).
 */
export default function BrandLogo3D({
  size = 44,
  motion = "sway",
  tone = "dark",
  layers = 7,
  className = "",
  label,
}: BrandLogo3DProps) {
  const slices = Array.from({ length: layers });
  const style = {
    "--bl-size": `${size}px`,
    "--bl-mid": (layers - 1) / 2,
  } as CSSProperties;

  const renderPart = (part: "sail" | "keel") => (
    <span className={`bl3d-part bl3d-${part}`}>
      <span className="bl3d-cap bl3d-cap--back" />
      {slices.map((_, i) => (
        <span
          key={i}
          className="bl3d-slice"
          style={{ "--i": i } as CSSProperties}
        />
      ))}
      <span className="bl3d-cap bl3d-cap--front" />
    </span>
  );

  return (
    <span
      className={`bl3d bl3d--${motion} bl3d--${tone} ${className}`.trim()}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="bl3d-object">
        {renderPart("sail")}
        {renderPart("keel")}
      </span>
      <span className="bl3d-shadow" />
    </span>
  );
}
