import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function StudioNavigation({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    close.current?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return (
    <>
      <div
        ref={panel}
        className={`navigation ${open ? "mobile-open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Navigation" : undefined}
        onKeyDown={(event) => {
          if (!open) return;
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const targets = Array.from(
              panel.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), select:not(:disabled), a[href]",
              ) ?? [],
            );
            const first = targets[0],
              last = targets.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <button
          ref={close}
          className="nav-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </div>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Dismiss navigation"
          tabIndex={-1}
          onClick={onClose}
        />
      )}
    </>
  );
}
