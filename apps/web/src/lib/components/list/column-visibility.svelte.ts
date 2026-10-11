/** A list column the reader can show or hide; `hideable: false` pins it (the record's name). */
export type ListColumn<Id extends string = string> = {
  readonly id: Id;
  readonly label: string;
  readonly hideable?: boolean;
  /** Hidden until the reader turns it on. */
  readonly hidden?: boolean;
};

/**
 * Which columns a list shows, saved per list in the browser (#301). The
 * server renders the defaults; `restore()` applies the saved choice once the
 * page is in the browser, so a reader's columns follow them across visits
 * without a round trip. Storage that is missing, unreadable or names a pinned
 * column is ignored.
 */
export class ColumnVisibility<Id extends string> {
  #shown = $state<Record<string, boolean>>({});
  readonly #key: string;
  readonly columns: readonly ListColumn<Id>[];

  constructor(list: string, columns: readonly ListColumn<Id>[]) {
    this.#key = `vmb:list-columns:${list}`;
    this.columns = columns;
    this.#shown = Object.fromEntries(columns.map((column) => [column.id, !column.hidden]));
  }

  visible(id: Id): boolean {
    return this.#shown[id] ?? true;
  }

  hideable(id: Id): boolean {
    return this.columns.find((column) => column.id === id)?.hideable !== false;
  }

  /** Whether any column differs from its default, which the View button's dot reports (ADR-0051 rule 6). */
  get changed(): boolean {
    return this.columns.some((column) => this.visible(column.id) !== !column.hidden);
  }

  set(id: Id, visible: boolean): void {
    if (!this.hideable(id)) return;
    this.#shown[id] = visible;
    this.#save();
  }

  /** Puts every column back to its default, and forgets the saved choice. */
  reset(): void {
    this.#shown = Object.fromEntries(this.columns.map((column) => [column.id, !column.hidden]));
    this.#save();
  }

  #save(): void {
    try {
      if (this.changed) localStorage.setItem(this.#key, JSON.stringify(this.#shown));
      else localStorage.removeItem(this.#key);
    } catch {
      // storage full or disabled: the choice lasts for this page only
    }
  }

  restore(): void {
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem(this.#key) ?? "null");
    } catch {
      return;
    }
    if (!saved || typeof saved !== "object") return;

    for (const column of this.columns) {
      const value = (saved as Record<string, unknown>)[column.id];
      if (typeof value === "boolean" && this.hideable(column.id)) this.#shown[column.id] = value;
    }
  }
}
