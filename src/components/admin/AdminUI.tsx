"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions/admin";

export const inputClass =
  "w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-accent";
export const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-ink-soft";

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  hint,
  required,
  dir,
  ...rest
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  hint?: string;
  required?: boolean;
  dir?: "ltr" | "rtl";
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "name" | "type" | "dir">) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} {required ? <span className="text-state-error">*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        dir={dir}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
        {...rest}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-brand-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 4,
  hint,
  dir,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
  dir?: "ltr" | "rtl";
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        dir={dir}
        defaultValue={defaultValue ?? ""}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-brand-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue ?? ""} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="mt-0.5 size-4 accent-[--color-brand-accent]"
        />
        <span>{label}</span>
      </label>
      {hint ? <p className="mt-1 ps-6 text-xs text-brand-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({ children = "Save" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center rounded bg-brand-accent px-5 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:cursor-progress disabled:opacity-70"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

/** Wraps a server action, renders its result, and never claims success falsely. */
export function ActionForm({
  action,
  children,
  encType,
  className = "",
}: {
  action: (prev: ActionState | null, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  encType?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionState | null, FormData>(action, null);
  return (
    <form action={formAction} encType={encType} className={className}>
      {state?.error ? (
        <p role="alert" className="mb-4 rounded border border-state-error/30 bg-state-error-bg px-4 py-3 text-sm text-state-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="mb-4 rounded border border-state-success/30 bg-state-success-bg px-4 py-3 text-sm text-state-success">
          {state.message ?? "Saved."}
        </p>
      ) : null}
      {children}
    </form>
  );
}
