"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Hand-built modal and drawer. No library.
 *
 * What "hand-built" has to actually mean, or it is just a div:
 *
 *  - focus moves into the dialog on open and is *restored* to the element that
 *    opened it on close, so keyboard users are not dumped at the top of the page
 *  - Tab and Shift+Tab cycle within the dialog and cannot escape it
 *  - Escape closes
 *  - the background scroll is locked without the page shifting sideways as the
 *    scrollbar disappears
 *  - the overlay is inert to assistive tech via aria-modal + role="dialog"
 *  - a click on the backdrop closes, but a drag that *starts* inside the dialog
 *    and ends on the backdrop does not — that is a text selection, not a dismiss
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function useDialogBehaviour(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Tracks whether a pointer gesture began inside the panel.
  const pressStartedInside = useRef(false);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    // Lock scroll. Padding compensates for the vanishing scrollbar so the page
    // behind does not visibly jump when the dialog opens.
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    // Focus the first focusable element, or the panel itself if there is none.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends. Without this, Tab walks out into the page behind.
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  const onBackdropPointerDown = useCallback((event: React.PointerEvent) => {
    pressStartedInside.current = panelRef.current?.contains(event.target as Node) ?? false;
  }, []);

  const onBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (pressStartedInside.current) {
        pressStartedInside.current = false;
        return;
      }
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  return { panelRef, onBackdropPointerDown, onBackdropClick };
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Screen-reader description, and the visible subtitle when given. */
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "center" is a modal; "right" is a drawer. Same primitive either way. */
  placement?: "center" | "right";
}

export function Overlay({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement = "center",
}: OverlayProps) {
  const { panelRef, onBackdropPointerDown, onBackdropClick } = useDialogBehaviour(open, onClose);

  if (!open || typeof document === "undefined") return null;

  const isDrawer = placement === "right";

  return createPortal(
    <div
      className={[
        "fixed inset-0 z-50 flex",
        isDrawer ? "justify-end" : "items-center justify-center p-4",
      ].join(" ")}
      onPointerDown={onBackdropPointerDown}
      onClick={onBackdropClick}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[rgb(0_0_0/0.62)] backdrop-blur-[2px]"
        style={{ animation: "fade var(--t-move) var(--ease-out) both" }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? "overlay-description" : undefined}
        tabIndex={-1}
        className={[
          "relative flex flex-col bg-[var(--content)] shadow-[var(--shadow-float)] outline-none",
          isDrawer
            ? "h-full w-full max-w-[520px] border-l border-[var(--line)]"
            : "w-full max-w-[460px] rounded-[var(--r-card)] border border-[var(--line-strong)]",
        ].join(" ")}
        style={{
          animation: `${isDrawer ? "slide-in" : "pop-in"} var(--t-move) var(--ease-out) both`,
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description && (
              <p id="overlay-description" className="mt-1 text-[13px] text-ink-faint">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 grid size-11 min-h-11 shrink-0 place-items-center rounded-[var(--r-control)] text-ink-faint transition-colors hover:bg-[var(--content-hover)] hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4">
            {footer}
          </footer>
        )}
      </div>

      <style>{`
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pop-in {
          from { opacity: 0; transform: translateY(8px) scale(.985) }
          to { opacity: 1; transform: none }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(16px) }
          to { opacity: 1; transform: none }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes pop-in { from { opacity: 1 } to { opacity: 1 } }
          @keyframes slide-in { from { opacity: 1 } to { opacity: 1 } }
          @keyframes fade { from { opacity: 1 } to { opacity: 1 } }
        }
      `}</style>
    </div>,
    document.body,
  );
}
