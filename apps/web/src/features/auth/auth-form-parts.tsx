import type { InputHTMLAttributes, ReactNode } from 'react';

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

/** A labelled input of the auth pages, with its validation message. */
export function AuthField({ id, label, error, ...input }: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input id={id} {...input} className={INPUT_CLASS} />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** The red banner of a failed auth request. */
export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {children}
    </div>
  );
}

/** The green banner of a request that went through (a link was sent, a password changed). */
export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
    >
      {children}
    </div>
  );
}

/** The full-width submit button of the auth pages. */
export function AuthSubmit({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
