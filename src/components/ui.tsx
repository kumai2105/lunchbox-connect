import { cloneElement, isValidElement, useId } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './icons';

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
  const cls = `photo-avatar photo-avatar-${size}`;
  if (photoUrl) {
    return <img className={cls} src={photoUrl} alt="" />;
  }
  return <div className={`${cls} photo-avatar-fallback`}>{initials}</div>;
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
  icon,
  to,
}: {
  label: string;
  value: ReactNode;
  trend?: string;
  icon?: IconName;
  /** When set, the whole card becomes a real drill-down link (blueprint Part 8). */
  to?: string;
}) {
  const body = (
    <>
      <div className="label">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </div>
      <div className="value">{value}</div>
      {trend && <div className="trend">{trend}</div>}
    </>
  );
  if (to) {
    return (
      <Link className="stat stat-link" to={to}>
        {body}
        <span className="stat-go">
          <Icon name="arrowRight" size={14} />
        </span>
      </Link>
    );
  }
  return <div className="stat">{body}</div>;
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

/**
 * A labelled form control.
 *
 * The <label> used to carry no `htmlFor`, and the control sits beside it as a
 * SIBLING rather than nested inside it. HTML associates a label with a control
 * by one of exactly those two mechanisms and no other, so every one of the 50
 * fields built with this component was, to the accessibility tree, an unlabelled
 * box. A screen-reader user filling in the Create class dialog heard "edit text"
 * three times and nothing about which was the name, the grade or the
 * institution. Voice control had nothing to address them by either.
 *
 * The id is generated with useId() rather than derived from the label text:
 * labels repeat across dialogs ("Name" appears on several), and duplicate ids
 * would point every one of them at whichever control rendered first.
 *
 * A control that already carries its own id keeps it, and the label points at
 * that instead of overwriting it.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const generatedId = useId();
  let controlId: string | undefined;
  let control = children;

  if (isValidElement(children)) {
    const existingId = (children.props as { id?: string }).id;
    controlId = existingId ?? generatedId;
    if (!existingId) {
      control = cloneElement(children as ReactElement<{ id?: string }>, { id: generatedId });
    }
  }

  // htmlFor is left undefined when the child is not a single element (a
  // fragment, say): a label pointing at an id that does not exist is a
  // different bug, not a fix.
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {control}
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
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
