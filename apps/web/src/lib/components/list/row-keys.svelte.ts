import { modified, shouldIgnore } from "$lib/components/key-guard.js";
import { shortcuts, useShortcuts, type ShortcutRow } from "$lib/components/shortcuts.svelte.js";
import ListIcon from "@lucide/svelte/icons/list";
import MousePointerClickIcon from "@lucide/svelte/icons/mouse-pointer-click";

/** A row action as the keyboard sees it: its key, and what pressing it does. */
type KeyedAction = {
  /** As `KeyboardEvent.key` names it, a letter in either case: "e", "Backspace". */
  key?: string;
  run?: () => void;
};

export type RowKeysOptions<T extends { id: string }> = {
  /** Keyboard rows are on unless a list turns them off (ADR-0052 rule 4). */
  enabled?: boolean;
  /** The list's name on the sheet: "Divisions" makes "On the Divisions list". */
  title: string;
  items: () => T[];
  open: (item: T) => void;
  /** The actions a row offers now; one whose `key` is pressed runs. */
  actions: (item: T) => KeyedAction[];
  /** What each key does, for the sheet's "On a row" section; each row's keys are marked `single`. */
  help: ShortcutRow[];
};

const ROW = "[data-row-id]";

const same = (want: string, got: string) =>
  want.length === 1 ? want.toLowerCase() === got.toLowerCase() : want === got;

/**
 * Keyboard rows for a list (ADR-0052 rule 4), on unless the list passes `enabled: false`.
 * ↑↓ or J/K mark a row, Enter opens it, Esc leaves it, and each action's key acts on the
 * marked row, else the row holding focus, else the row under the pointer; never while typing
 * or with another layer open. Delete asks first, as its action does; one key never deletes.
 *
 * With the single-key switch off (rule 5) J/K and every action key do nothing, Backspace
 * included: it isn't a printable character, but gating the action keys as one set is the
 * simpler rule to state. The arrows, Enter and Esc stay.
 *
 * Create it while the page's component initialises, and spread `row(item)` on each
 * `<tr>`, `menu(item).content` on its row menu's content. With `enabled` false all of it is
 * inert and adds nothing to the page.
 */
export class RowKeys<T extends { id: string }> {
  readonly enabled: boolean;
  /** The id of the marked row. */
  marked = $state<string | null>(null);
  readonly #options: RowKeysOptions<T>;

  constructor(options: RowKeysOptions<T>) {
    this.#options = options;
    this.enabled = options.enabled ?? true;
    if (!this.enabled) return;

    useShortcuts(() => [
      {
        title: `On the ${options.title} list`,
        icon: ListIcon,
        rows: [
          { keys: ["/"], what: "Search", single: true },
          { keys: ["↑", "↓"], alt: ["J", "K"], altSingle: true, what: "Move between rows" },
          { keys: ["Enter"], what: "Open the row" },
          { keys: ["Esc"], what: "Leave the row" }
        ]
      },
      { title: "On a row", icon: MousePointerClickIcon, rows: options.help }
    ]);

    $effect(() => {
      window.addEventListener("keydown", this.#keydown);
      return () => window.removeEventListener("keydown", this.#keydown);
    });

    // a page, sort or filter that drops the marked row takes the mark with it
    $effect(() => {
      if (this.marked && !options.items().some((item) => item.id === this.marked)) {
        this.marked = null;
      }
    });

    // keep the marked row in sight as it moves
    $effect(() => {
      if (this.marked) {
        document
          .querySelector(`[data-row-id="${CSS.escape(this.marked)}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }
    });
  }

  /** Whether the keys that are printable characters work: keyboard rows on, and the single-key switch on. */
  get keys(): boolean {
    return this.enabled && shortcuts.singleKey;
  }

  /** Attributes for a row's `<tr>`: its id, and the mark. */
  row(item: T): Record<string, string | undefined> {
    if (!this.enabled) return {};
    const marked = this.marked === item.id;
    return {
      "data-row-id": item.id,
      "data-marked": marked ? "" : undefined,
      "aria-current": marked ? "true" : undefined
    };
  }

  /**
   * Props for a row's menu, so its keys act on that row and close the menu. The menu stays
   * the library's own, uncontrolled: bits-ui leaves a controlled one half closed, with the
   * page locked, so the key closes it the way Esc does.
   */
  menu(item: T): { content: { onkeydown?: (event: KeyboardEvent) => void } } {
    if (!this.enabled) return { content: {} };
    return {
      content: {
        onkeydown: (event) => {
          if (modified(event) || event.repeat) return;
          if (!this.#act(event, item)) return;
          event.preventDefault();
          event.stopPropagation();
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        }
      }
    };
  }

  #act(event: KeyboardEvent, item: T): boolean {
    if (!shortcuts.singleKey) return false;
    const action = this.#options
      .actions(item)
      .find((candidate) => candidate.run && candidate.key && this.#matches(candidate.key, event));
    if (!action) return false;
    action.run!();
    return true;
  }

  #matches(key: string, event: KeyboardEvent): boolean {
    // Delete is the other name of Backspace
    return key === "Backspace"
      ? event.key === "Backspace" || event.key === "Delete"
      : same(key, event.key);
  }

  #move(step: number) {
    const items = this.#options.items();
    if (!items.length) return;
    const at = items.findIndex((item) => item.id === this.marked);
    const next =
      at === -1
        ? step > 0
          ? 0
          : items.length - 1
        : Math.min(items.length - 1, Math.max(0, at + step));
    this.marked = items[next]!.id;
  }

  /** The row an action key means: the marked one, else the one holding focus, else the one under the pointer. */
  #rowFor(event: KeyboardEvent): T | undefined {
    const items = this.#options.items();
    const marked = items.find((item) => item.id === this.marked);
    if (marked) return marked;
    const id =
      (event.target instanceof Element ? event.target.closest<HTMLElement>(ROW) : null)?.dataset
        .rowId ?? document.querySelector<HTMLElement>(`${ROW}:hover`)?.dataset.rowId;
    return items.find((item) => item.id === id);
  }

  // whether the key before this one was Tab, which is how focus reached a button on purpose
  #tabbed = false;

  #keydown = (event: KeyboardEvent) => {
    const tabbed = this.#tabbed;
    this.#tabbed = event.key === "Tab";
    if (shouldIgnore(event)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "ArrowDown" || (key === "j" && shortcuts.singleKey)) {
      event.preventDefault();
      this.#move(1);
    } else if (key === "ArrowUp" || (key === "k" && shortcuts.singleKey)) {
      event.preventDefault();
      this.#move(-1);
    } else if (key === "Enter") {
      const item = this.#options.items().find((candidate) => candidate.id === this.marked);
      // On a link or a button Enter is theirs. A layer's button is the exception when focus
      // did not come to it by Tab: closing a layer puts focus back there, and the marked row
      // must still open then. Space still presses the button.
      const own =
        event.target instanceof Element &&
        event.target.closest("a, button, summary") &&
        (tabbed || !event.target.closest("[data-layer-trigger]"));
      if (!item || own || event.repeat) return;
      event.preventDefault();
      this.#options.open(item);
    } else if (key === "Escape") {
      this.marked = null;
    } else if (!event.repeat) {
      const item = this.#rowFor(event);
      if (item && this.#act(event, item)) event.preventDefault();
    }
  };
}
