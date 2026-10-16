import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AccordionSectionProps {
  id: string;
  icon?: React.ElementType;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

export default function AccordionSection({
  id,
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <section className="settings-section">
      <button
        type="button"
        className="settings-section-header"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={`panel-${id}`}
      >
        {Icon && <Icon className="settings-section-icon" aria-hidden="true" />}
        <div className="settings-section-titles">
          <h3 className="settings-section-title">{title}</h3>
          {subtitle && <p className="settings-section-subtitle">{subtitle}</p>}
        </div>
        {open ? <ChevronUp className="settings-section-chevron" /> : <ChevronDown className="settings-section-chevron" />}
      </button>
      {open && (
        <div id={`panel-${id}`} className="settings-section-content">
          {children}
        </div>
      )}
    </section>
  );
}
