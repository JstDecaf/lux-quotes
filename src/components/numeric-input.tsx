"use client";
import { useState, useEffect, useRef } from "react";

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  /** Multiply stored value for display, e.g. 100 for percentages stored as 0.5 shown as 50 */
  displayMultiplier?: number;
}

/**
 * A numeric input that calls onChange on every valid keystroke for live
 * calculation updates, while keeping the raw string so partial inputs
 * like "3" don't get reformatted to "3.0" before the user finishes.
 */
export function NumericInput({
  value,
  onChange,
  displayMultiplier = 1,
  className,
  ...props
}: NumericInputProps) {
  const display = value * displayMultiplier;
  const [local, setLocal] = useState(String(display));
  const [focused, setFocused] = useState(false);
  const lastCommitted = useRef(value);

  // Keep display in sync when external value changes (but not while typing)
  useEffect(() => {
    if (!focused) setLocal(String(display));
  }, [display, focused]);

  return (
    <input
      type="number"
      className={className}
      value={focused ? local : String(display)}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        // Fire onChange immediately for live calculation updates
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) {
          const committed = parsed / displayMultiplier;
          lastCommitted.current = committed;
          onChange(committed);
        }
      }}
      onFocus={(e) => {
        setFocused(true);
        setLocal(e.target.value);
        lastCommitted.current = value;
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseFloat(local);
        if (!isNaN(parsed)) {
          const committed = parsed / displayMultiplier;
          // Always fire on blur to ensure final value is committed
          if (committed !== lastCommitted.current) {
            onChange(committed);
          }
        } else {
          // Reset to previous value on invalid input
          setLocal(String(display));
        }
      }}
      {...props}
    />
  );
}
