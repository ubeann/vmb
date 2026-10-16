import { get } from "svelte/store";
import { superForm, type SuperValidated } from "sveltekit-superforms";
import type { ClientValidationAdapter } from "sveltekit-superforms/adapters";
import { useDiscardGuard, type DiscardGuard } from "./discard.svelte.js";

/**
 * A record's create or edit form on Superforms, with its "Discard changes?"
 * guard (#302). The route's action redirects to the record once saved; on a
 * full page that redirect is followed, and in a layer `onsaved` takes its
 * place, so the layer can close, refresh the list and say so.
 */
export function useRecordForm<T extends Record<string, unknown>>(
  data: SuperValidated<T>,
  options: {
    /** The shared schema's client adapter: the server checks the same rules. */
    validators: ClientValidationAdapter<Partial<T>, Record<string, unknown>>;
    /** Called with what was saved, in place of following the redirect. */
    onsaved?: (saved: T) => void;
    /** Asked before a save is sent; answering false keeps the form as it is (a save that needs a "sure?"). */
    beforeSubmit?: (data: T) => boolean | Promise<boolean>;
  }
): { superform: ReturnType<typeof superForm<T>>; guard: DiscardGuard } {
  const superform = superForm(data, {
    validators: options.validators,
    // Superforms' own scroll asks only whether the field is on screen, so in a
    // layer it leaves one scrolled out of the card's view; this one scrolls the
    // card too, and brings the label above the field into view with it
    scrollToError: {
      block: "center",
      behavior:
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth"
    },
    onSubmit: async ({ cancel }) => {
      if (options.beforeSubmit && !(await options.beforeSubmit(get(superform.form)))) cancel();
    },
    onResult: ({ result, cancel }) => {
      if (result.type !== "redirect") return;
      // saved: leaving loses nothing now
      guard.release();
      if (!options.onsaved) return;
      cancel();
      options.onsaved(get(superform.form));
    }
  });
  const guard = useDiscardGuard(() => superform.isTainted());
  return { superform, guard };
}
