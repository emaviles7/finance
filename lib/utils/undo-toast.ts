import { toast } from "sonner";

/** Muestra un toast de éxito con un botón "Deshacer" que ejecuta onUndo. */
export function showUndoToast(message: string, onUndo: () => void | Promise<void>) {
  toast.success(message, {
    action: {
      label: "Deshacer",
      onClick: () => {
        void onUndo();
      },
    },
  });
}
