"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

export function ConfirmSubmitButton({
  confirmation,
  pendingText = "Please wait...",
  loadingIcon = <LoaderCircle size={16} className="animate-spin" />,
  onClick,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirmation: string; pendingText?: string; loadingIcon?: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      disabled={disabled || pending}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? (
        <>
          {loadingIcon}
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
