"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

/** Built on the native <dialog>: focus trap, Escape to close and inert background come from the browser. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="modal-title"
      className={`m-auto w-[calc(100%-2rem)] rounded-card border border-line bg-surface p-0 text-ink ${wide ? "max-w-3xl" : "max-w-lg"}`}>
      {open && (
        <div>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 id="modal-title">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
          </div>
          <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Dangerous actions always go through this confirmation. */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", loading, onConfirm, onClose }: { open: boolean; title: string; message: string; confirmLabel?: string; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Keep it</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
