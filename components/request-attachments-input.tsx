"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { AttachmentFileName } from "@/components/attachment-file-name";

const maxFiles = 5;
const maxBytes = 10 * 1024 * 1024;
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".docx", ".txt", ".csv", ".json"];

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function extensionFor(file: File) {
  return file.name.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? "";
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function RequestAttachmentsInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  function syncInput(nextFiles: File[]) {
    const transfer = new DataTransfer();
    for (const file of nextFiles) transfer.items.add(file);
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  function updateFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    syncInput(nextFiles);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const incoming = Array.from(event.target.files ?? []);
    const merged = [...files, ...incoming].filter((file, index, all) => all.findIndex((item) => fileKey(item) === fileKey(file)) === index);

    if (merged.length > maxFiles) {
      setError(`Attach up to ${maxFiles} files.`);
      updateFiles(merged.slice(0, maxFiles));
      return;
    }

    const invalid = merged.find((file) => !allowedExtensions.includes(extensionFor(file)));
    if (invalid) {
      setError(`${invalid.name} is not an allowed file type.`);
      updateFiles(files);
      return;
    }

    const tooLarge = merged.find((file) => file.size > maxBytes);
    if (tooLarge) {
      setError(`${tooLarge.name} must be 10 MB or smaller.`);
      updateFiles(files);
      return;
    }

    updateFiles(merged);
  }

  function removeFile(key: string) {
    setError("");
    updateFiles(files.filter((file) => fileKey(file) !== key));
  }

  return (
    <div className="pt-2">
      <div className="text-sm font-semibold text-neutral-300 block mb-2">Attach files (Optional)</div>
      <label htmlFor="attachments" className="relative w-full border-2 border-dashed border-neutral-800 bg-[#0a0a0a] rounded-xl p-8 flex flex-col items-center justify-center text-neutral-500 hover:border-neutral-600 transition-all cursor-pointer">
        <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center mb-3 border border-neutral-800">
          <Paperclip size={20} className="text-neutral-400" />
        </div>
        <span className="text-sm font-medium">Click to attach files</span>
        <span className="text-xs mt-1 text-neutral-600">JPG, PNG, WebP, PDF, DOCX, TXT, CSV, or JSON up to 10MB each</span>
        <input
          ref={inputRef}
          id="attachments"
          name="attachments"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt,.csv,.json,image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,application/json"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={handleChange}
        />
      </label>

      {files.length > 0 ? (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-[#0a0a0a] divide-y divide-neutral-800">
          <div className="px-4 py-3 text-xs font-semibold text-emerald-400">{files.length} file{files.length === 1 ? "" : "s"} ready to upload</div>
          {files.map((file) => (
            <div key={fileKey(file)} className="px-4 py-3 flex items-center gap-3">
              <FileText size={16} className="text-neutral-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <AttachmentFileName fileName={file.name} className="text-sm text-neutral-200" />
                <div className="text-xs text-neutral-600">{extensionFor(file).replace(".", "").toUpperCase()} · {formatBytes(file.size)}</div>
              </div>
              <button type="button" onClick={() => removeFile(fileKey(file))} className="h-8 w-8 rounded-lg border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-700 inline-flex items-center justify-center" aria-label={`Remove ${file.name}`}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
