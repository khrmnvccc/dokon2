import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from './cn';

// Kassa: label tepada, xato pastda qizil, h-10, rounded-lg, bg-surface-2.
export const controlBase =
  'w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 transition-colors outline-none focus:bg-surface focus:border-[var(--card)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--card)_15%,transparent)] disabled:text-ink-3 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlBase, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlBase, 'min-h-20 py-2', className)} {...props} />;
});

const chevron = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a6' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, style, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlBase, 'h-10 appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8', className)} style={{ backgroundImage: chevron, ...style }} {...props}>
      {children}
    </select>
  );
});

export function Field({ label, error, hint, children, htmlFor, required, className }: {
  label?: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; htmlFor?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-2">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-danger anim-fade" role="alert"><AlertCircle className="size-3.5 shrink-0" />{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm text-ink-2', className)}>
      <input type="checkbox" className="size-4 rounded border-line-strong accent-[var(--primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
