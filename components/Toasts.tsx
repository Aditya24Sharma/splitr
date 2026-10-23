import { Toaster } from "sonner";

/**
 * Where toasts appear: results of a button press that came back from the
 * server. Top centre, so they never cover the phone tab bar or a save bar.
 */
export function Toasts() {
  return (
    <Toaster
      position="top-center"
      // Clear of the iPhone notch and status bar
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "w-full flex items-center gap-2.5 rounded-3xl border border-ink bg-surface px-5 py-3.5 text-sm font-semibold text-ink shadow-[0_4px_0_0_#0B0B0C]",
          error: "!border-danger !bg-danger-dim !text-danger !shadow-[0_4px_0_0_#D9370B]",
          success: "!bg-mint-dim",
          icon: "shrink-0",
          // Sonner floats the spinner over the corner; keep it in the icon slot
          loader: "!relative",
        },
      }}
    />
  );
}
