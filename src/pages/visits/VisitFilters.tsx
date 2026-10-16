import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDays, ChevronDown } from "lucide-react";
import { formatDate, parseDate, toIsoDate } from "./visitsUtils";

type VisitDatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: Date;
  maxDate?: Date;
};

export function VisitDatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
}: VisitDatePickerProps) {
  return (
    <div className="visits-date-field">
      <span className="visits-field-label">{label}</span>
      <div className="visits-date-input-wrap">
        <DatePicker
          selected={parseDate(value)}
          onChange={(date: Date | null) => date && onChange(toIsoDate(date))}
          minDate={minDate}
          maxDate={maxDate}
          dateFormat="MMM d, yyyy"
          fixedHeight
          showPopperArrow={false}
          popperPlacement="bottom-start"
          calendarClassName={`visits-react-calendar ${
            label === "End date" ? "visits-end-calendar" : ""
          }`}
          customInput={
            <button
              type="button"
              className="visits-date-trigger-pro"
              aria-label={`Choose ${label.toLowerCase()}`}
            >
              <CalendarDays size={14} className="vdp-cal-icon" />
              <strong className="vdp-date-text">{formatDate(value)}</strong>
              <ChevronDown size={14} className="vdp-chevron" />
            </button>
          }
        />
      </div>
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  const isSelected = Boolean(value && !value.toLowerCase().startsWith("all"));

  return (
    <div className={`visits-filter-field ${isSelected ? "filter-active" : ""}`}>
      <span className="visits-field-label">{label}</span>
      <div className="visits-select-wrapper">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="visits-select-chevron" aria-hidden="true" />
      </div>
    </div>
  );
}
