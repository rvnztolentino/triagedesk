"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingText?: string;
  loadingIcon?: React.ReactNode;
  // When set, overrides the form-wide status. Use this to scope the pending
  // state to a single action when multiple submit buttons share one form.
  pending?: boolean;
}

export function SubmitButton({
  children,
  pendingText = "Please wait...",
  loadingIcon = <LoaderCircle size={16} className="animate-spin" />,
  className,
  disabled,
  pending: pendingProp,
  ...props
}: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingProp ?? formPending;

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn("btn btn--primary btn--block", className)}
      {...props}
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
