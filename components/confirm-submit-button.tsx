"use client";

import type { ButtonHTMLAttributes } from "react";

export function ConfirmSubmitButton({
  confirmation,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirmation: string }) {
  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    />
  );
}
