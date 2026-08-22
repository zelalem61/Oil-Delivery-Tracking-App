import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} />;
}
export function Alert({ children }: { children: ReactNode }) {
  return <div role="alert">{children}</div>;
}
