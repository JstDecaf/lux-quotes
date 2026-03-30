"use client";
import { useState, useEffect } from "react";

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  /** Multiply stored value for display, e.g. 100 for percentages stored as 0.5 shown as 50 */
  displayMultiplier?: number;
}

/**
 * A numeric input that only commits the parsed value on blur.
 * While the user is typing, the raw string is kept so partial inputs
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

  // Keep display in sync when external value changes (but not while typing)
  useEffect(() => {
    if (!focused) setLocal(String(display));
  }, [display, focused]);

  return (
    <input
      type="number"
      className={className}
      value={focused ? local : String(display)}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        setLocal(e.target.value);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseFloat(local);
        if (!isNaN(parsed)) {
          onChange(parsed / displayMultiplier);
        } else {
          setLocal(String(display)); // reset on invalid input
        }
      }}
      {...props}
    />
  );
}
