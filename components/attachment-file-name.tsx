import { cn } from "@/lib/utils";

function splitExtension(fileName: string) {
  const match = fileName.match(/^(.*?)(\.[^.]{1,12})$/);
  if (!match) return { base: fileName, extension: "" };
  return { base: match[1] || fileName, extension: match[2] };
}

export function AttachmentFileName({ fileName, className }: { fileName: string; className?: string }) {
  const { base, extension } = splitExtension(fileName);

  return (
    <span title={fileName} className={cn("inline-flex max-w-full min-w-0 align-bottom", className)}>
      <span className="min-w-0 truncate">{base}</span>
      {extension ? <span className="shrink-0">{extension}</span> : null}
    </span>
  );
}
