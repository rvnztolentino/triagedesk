"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingText?: string;
  loadingIcon?: React.ReactNode;
}

export function SubmitButton({
  children,
  pendingText = "Please wait...",
  loadingIcon = <LoaderCircle size={16} className="animate-spin" />,
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        "w-full h-11 bg-accent hover:opacity-90 text-accent-fg rounded-[var(--radius-control)] text-sm font-medium transition-opacity inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
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
