import React from "react";
import { Input } from "./input";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface CalendarProps {
  mode?: "single" | "range";
  selected?: Date | DateRange;
  onSelect?: (date: Date | DateRange | undefined) => void;
  initialFocus?: boolean;
  defaultMonth?: Date;
  numberOfMonths?: number;
  className?: string;
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  className,
  ...props
}: CalendarProps) {
  if (mode === "range") {
    const range = selected as DateRange;
    return (
      <div className={`p-4 space-y-4 ${className}`}>
        <div>
          <label className="text-sm font-medium">From Date</label>
          <Input
            type="date"
            value={range?.from ? range.from.toISOString().split("T")[0] : ""}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              if (onSelect && range?.to) {
                onSelect({ from: newDate, to: range.to });
              } else if (onSelect) {
                onSelect({ from: newDate, to: new Date() });
              }
            }}
          />
        </div>
        <div>
          <label className="text-sm font-medium">To Date</label>
          <Input
            type="date"
            value={range?.to ? range.to.toISOString().split("T")[0] : ""}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              if (onSelect && range?.from) {
                onSelect({ from: range.from, to: newDate });
              } else if (onSelect) {
                onSelect({ from: new Date(), to: newDate });
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <Input
        type="date"
        value={selected instanceof Date ? selected.toISOString().split("T")[0] : ""}
        onChange={(e) => {
          if (onSelect) {
            onSelect(new Date(e.target.value));
          }
        }}
      />
    </div>
  );
}
