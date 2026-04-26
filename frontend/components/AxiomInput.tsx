import * as React from "react";

type AxiomInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function AxiomInput({ label, className = "", ...props }: AxiomInputProps) {
  return (
    <label className="flex w-full flex-col gap-2">
      <span className="text-sm font-medium text-surface-700">{label}</span>
      <input
        {...props}
        className={`input-field ${className}`}
      />
    </label>
  );
}