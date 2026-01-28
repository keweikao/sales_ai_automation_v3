import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;

const SheetTrigger = DialogPrimitive.Trigger;

const SheetPortal = DialogPrimitive.Portal;

const SheetClose = DialogPrimitive.Close;

const SheetBackdrop = ({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) => (
  <DialogPrimitive.Backdrop
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

interface SheetContentProps extends DialogPrimitive.Popup.Props {
  side?: "left" | "right";
}

const SheetContent = ({
  className,
  children,
  side = "left",
  ...props
}: SheetContentProps) => (
  <SheetPortal>
    <SheetBackdrop />
    <DialogPrimitive.Popup
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-y-0 z-50 flex flex-col gap-4 border bg-background p-6 shadow-lg duration-300 data-[state=closed]:animate-out data-[state=open]:animate-in",
        side === "left" &&
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left left-0",
        side === "right" &&
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right right-0",
        "w-full sm:w-80",
        className
      )}
      {...props}
    >
      {children}
      <SheetClose className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetClose>
    </DialogPrimitive.Popup>
  </SheetPortal>
);

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-left", className)}
    {...props}
  />
);

const SheetTitle = ({ className, ...props }: DialogPrimitive.Title.Props) => (
  <DialogPrimitive.Title
    className={cn(
      "font-semibold text-lg leading-none tracking-tight",
      className
    )}
    {...props}
  />
);

export {
  Sheet,
  SheetBackdrop,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
