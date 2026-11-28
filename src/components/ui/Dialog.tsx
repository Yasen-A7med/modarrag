"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogContextValue {
  readonly open: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly titleId: string;
  readonly descriptionId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export interface DialogProps {
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly children: React.ReactNode;
}

/**
 * Top-layer native `<dialog closedby="any">` wrapper preserving accessible modal focus,
 * scroll-chaining containment, light-dismiss, and compound component ergonomics.
 */
export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  const value = React.useMemo(
    () => ({ open, onOpenChange, titleId, descriptionId }),
    [open, onOpenChange, titleId, descriptionId]
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(DialogContext);
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        ctx?.onOpenChange?.(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DialogClose({
  children,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(DialogContext);
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        ctx?.onOpenChange?.(false);
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly hideClose?: boolean;
}

let supportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.("transition-behavior", "allow-discrete") || !document.body) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = "none";
  supportsDisplayTransition = getComputedStyle(probe).display === "block";
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.CSS?.supports?.("overlay", "auto") && canTransitionDisplay());
}

async function closeTopLayer(element: HTMLDialogElement): Promise<void> {
  if (!element.open) return;
  if (!supportsTopLayerExit()) {
    element.setAttribute("data-closing", "");
    const animations = element.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => window.setTimeout(r, 260)),
      ]);
    }
    if (!element.hasAttribute("data-closing")) return;
    element.removeAttribute("data-closing");
  }
  if (element.open) {
    element.close();
  }
}

export const DialogContent = React.forwardRef<HTMLDialogElement, DialogContentProps>(
  ({ className, children, hideClose = false, ...props }, ref) => {
    const ctx = React.useContext(DialogContext);
    const localRef = React.useRef<HTMLDialogElement | null>(null);
    const open = ctx?.open ?? false;

    const setRefs = React.useCallback(
      (node: HTMLDialogElement | null) => {
        localRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    React.useEffect(() => {
      const dialog = localRef.current;
      if (!dialog) return;

      if (open) {
        dialog.removeAttribute("data-closing");
        if (!dialog.open) {
          dialog.showModal();
        }
      } else if (dialog.open) {
        void closeTopLayer(dialog);
      }
    }, [open]);

    const handleClose = () => {
      if (ctx?.open) {
        ctx.onOpenChange?.(false);
      }
    };

    const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      ctx?.onOpenChange?.(false);
    };

    // Universal outside-click fallback for browsers without native `closedby="any"` support.
    const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
      const dialog = localRef.current;
      if (!dialog) return;
      if (event.clientX === 0 && event.clientY === 0) return;
      const rect = dialog.getBoundingClientRect();
      const clickedOutside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (clickedOutside) {
        ctx?.onOpenChange?.(false);
      }
    };

    return (
      <dialog
        ref={setRefs}
        closedby="any"
        aria-labelledby={ctx?.titleId}
        aria-describedby={ctx?.descriptionId}
        onClose={handleClose}
        onCancel={handleCancel}
        onClick={handleDialogClick}
        className={cn(
          "w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0 text-[var(--text-primary)] shadow-2xl",
          "focus:outline-none"
        )}
      >
        <div className={cn("relative p-5 sm:p-6", className)} {...props}>
          {children}
          {!hideClose && (
            <button
              type="button"
              onClick={() => ctx?.onOpenChange?.(false)}
              className={cn(
                "absolute top-4 end-4 inline-flex h-10 w-10 items-center justify-center rounded-xl",
                "border border-transparent text-[var(--text-muted)] transition-colors cursor-pointer",
                "hover:border-[var(--border-hairline)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B63CE]/40"
              )}
              aria-label="إغلاق النافذة"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </dialog>
    );
  }
);
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 pe-10 text-start", className)}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const ctx = React.useContext(DialogContext);
  return (
    <h2
      ref={ref}
      id={ctx?.titleId}
      className={cn("text-lg font-bold text-[var(--text-primary)]", className)}
      {...props}
    />
  );
});
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const ctx = React.useContext(DialogContext);
  return (
    <p
      ref={ref}
      id={ctx?.descriptionId}
      className={cn("text-sm text-[var(--text-secondary)] leading-relaxed", className)}
      {...props}
    />
  );
});
DialogDescription.displayName = "DialogDescription";

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    />
  );
}
