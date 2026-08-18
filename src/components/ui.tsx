import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Fast visual Student identification (docs/13 Decision 032 §5) — an optional
// photo with an initials fallback, never a broken-image state.
export function Avatar({
  photoUrl,
  initials,
  size = 'md',
}: {
  photoUrl?: string | null;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = `avatar avatar-${size}`;
  if (photoUrl) {
    return <img className={cls} src={photoUrl} alt="" />;
  }
  return <div className={`${cls} avatar-fallback`}>{initials}</div>;
}

export function Card({
  title,
  hint,
  actions,
  children,
  bodyClassName,
}: {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="head">
          {title && <h3>{title}</h3>}
          {hint && <span className="hint">{hint}</span>}
          <div className="spacer" />
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: ReactNode;
  trend?: string;
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {trend && <div className="trend">{trend}</div>}
    </div>
  );
}

export function PageHead({
  title,
  hint,
  actions,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {hint && <span className="hint">{hint}</span>}
      <div className="spacer" />
      {actions}
    </div>
  );
}

type BtnVariant = 'brand' | 'ghost' | 'amber' | 'default';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'md' | 'sm';
}

export function Btn({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: BtnProps) {
  const cls =
    ['btn', variant, size === 'sm' ? 'sm' : ''].filter(Boolean).join(' ') +
    (className ? ` ${className}` : '');
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Pill({ variant, children }: { variant: string; children: ReactNode }) {
  return <span className={`pill ${variant}`}>{children}</span>;
}

export function StatusDot({ color }: { color: 'green' | 'amber' | 'red' | 'gray' }) {
  return <span className={`status-dot sd-${color}`} />;
}

export function Spinner() {
  return <div className="spinner" />;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function Banner({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'warn' | 'err';
  children: ReactNode;
}) {
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
