<!--
  PROTOTYPE (prototype/list-kit): variants B, C and D, every rule from the 2026-10-09 grilling.
  Q1 no Status column, an Inactive pill after the name · Q2 a row click opens the record ·
  Q3 a ⋯ trigger · Q5 All | Trash as a segmented control in the toolbar · Q6 a button per
  filter, "More filters" past the second · Q7 a per-list placeholder · Q8 no description ·
  Q9 a smaller title with the action on its row · Q10 no paging when it all fits ·
  Q11 the description absorbs the spare width · Q13 one control shape · Q14 "n of m · Clear" ·
  Q15 the phone sheet lists the options. `tile` is Q4's question: solid, tint or glyph.
  Round 2 (2026-10-10): Q4 went to tinted; `toolbar` explores the desktop toolbar; the row menu
  takes a vertical ⋮ with Activate/Deactivate; the row hover paints every cell at once.
-->
<script lang="ts">
  // PROTOTYPE: every URL here goes through resolve() inside a helper the rule cannot follow
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import HeroIcon from "$lib/components/HeroIcon.svelte";
  import Page from "$lib/components/Page.svelte";
  import RecordTime from "$lib/components/RecordTime.svelte";
  import StatusPill from "$lib/components/StatusPill.svelte";
  import ColumnsMenu from "$lib/components/list/ColumnsMenu.svelte";
  import { ColumnVisibility } from "$lib/components/list/column-visibility.svelte.js";
  import { columnClass } from "$lib/components/list/columns.js";
  import ListFooter from "$lib/components/list/ListFooter.svelte";
  import ListSearch from "$lib/components/list/ListSearch.svelte";
  import SearchBox from "./SearchBox.svelte";
  import SortableHead from "$lib/components/list/SortableHead.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { RangeCalendar } from "$lib/components/ui/range-calendar/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { listHref, pageWindow, showingRange, type MasterListPathname } from "$lib/master/list.js";
  import { cn } from "$lib/utils.js";
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CirclePlusIcon from "@lucide/svelte/icons/circle-plus";
  import Columns3Icon from "@lucide/svelte/icons/columns-3";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import CalendarPlusIcon from "@lucide/svelte/icons/calendar-plus";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import ListFilterIcon from "@lucide/svelte/icons/list-filter";
  import LockIcon from "@lucide/svelte/icons/lock";
  import DeleteIcon from "@lucide/svelte/icons/delete";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Rows3Icon from "@lucide/svelte/icons/rows-3";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import PowerIcon from "@lucide/svelte/icons/power";
  import PowerOffIcon from "@lucide/svelte/icons/power-off";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import XIcon from "@lucide/svelte/icons/x";
  import { parseDate } from "@internationalized/date";
  import type { DateRange } from "bits-ui";
  import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS, type Division } from "@vmb/types";
  import { dateRange, formatRange, PRESET_RANGE, TODAY } from "./dates.js";
  import { onMount, type Component } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { toast } from "svelte-sonner";
  import type { PageData } from "./$types.js";

  type Toolbar = "row" | "filter" | "card" | "pills";
  type Chip = "green" | "outline" | "navy";
  let {
    data,
    tile,
    toolbar = "row",
    chip = "green",
    dates = "inline",
    view = false,
    strip = "end",
    searchBox = false,
    responsive = false,
    compactTools = false,
    sortBar = false,
    tabletPadding = false,
    sortInView = false,
    toolTone = "now",
    radius = "now",
    middle = "name"
  }: {
    data: PageData;
    tile: "solid" | "tint" | "glyph";
    toolbar?: Toolbar;
    chip?: Chip;
    // Round 7: "inline" puts the presets and calendar in the panel; "beside" gives each date
    // filter one row that opens a picker to the panel's left
    dates?: "inline" | "beside";
    // Round 10: a View panel (columns and rows per page) instead of Columns, a slim pager,
    // and row shortcuts shown in the row menu
    view?: boolean;
    // Round 11: where the in-use strip puts Clear all and the count. "end": the count and Clear
    // all at the far right; "inline": Clear all right after the chips, the search as a chip too,
    // the count in the footer; "lead": the count opens the strip, Clear all after the chips
    strip?: "end" | "inline" | "lead";
    // Round 14: the reworked search box, and the matched text marked in the rows
    searchBox?: boolean;
    // Round 15: the list card answers to its own width (container queries): Description goes
    // first, then rows fold to two lines, the name over "code · updated"
    responsive?: boolean;
    // Round 17: under 42rem of card (where Description folds too), Filter and View shrink to icons (the count badge and the
    // changed dot move to the corner), so the search keeps the row
    compactTools?: boolean;
    // Round 20: in two-line rows the header row (only "Name ↑" left) gives way to a sort menu
    // that also reaches the folded Code and Updated
    sortBar?: boolean;
    // Round 20: 16px of page padding instead of 24 between sm and lg
    tabletPadding?: boolean;
    // Round 21: View shows on phones too; once rows fold to two lines it trades Columns for
    // Sort by, and the header row goes
    sortInView?: boolean;
    // Round 22: light mode only (dark already shares one look). "now": the search a white field
    // with the strong --input edge, the tools cream with a --border hairline; "a": the search
    // dresses like the tools; "b": the tools dress like the search; "c": both meet halfway
    toolTone?: "now" | "a" | "b" | "c";
    // Round 23: "now": every control 10px (chips 8px), the card 10px; "scaled": corners a quarter
    // of the height, 8px on 32px controls and 11px on 44px touch ones, chips included, and the
    // card a step rounder than what sits inside it
    radius?: "now" | "scaled";
    // Round 24: who takes the spare width once Description folds (card 512–672px). "name": the
    // name column (Code and Updated sit against ⋮); "date": Updated (Code and the date follow
    // the name); "desc": the name column, carrying the description as a second line
    middle?: "name" | "date" | "desc";
  } = $props();

  const base = "/prototype/list-kit" as MasterListPathname;

  // Round 3: each filter carries an icon, shown on its chip and in the Filter menu
  // Round 4: `any` names the unset choice ("Any status"); `custom` adds a "Custom range…" stub
  // Round 5: `kind` picks the panel section: checkboxes for values, preset pills and a range
  // calendar for dates
  type Filter = {
    key: string;
    kind: "values" | "date";
    label: string;
    icon: Component;
    any: string;
    custom?: boolean;
    options: { value: string; label: string }[];
  };
  const DATE_PRESETS = [
    { value: "today", label: "Today" },
    { value: "week", label: "Last 7 days" },
    { value: "month", label: "This month" }
  ];
  const FILTERS: Filter[] = [
    {
      key: "status",
      kind: "values",
      label: "Status",
      icon: CircleDotIcon,
      any: "Any status",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" }
      ]
    },
    {
      key: "updated",
      kind: "date",
      label: "Updated",
      icon: CalendarClockIcon,
      any: "Any time",
      custom: true,
      options: DATE_PRESETS
    },
    {
      key: "created",
      kind: "date",
      label: "Created",
      icon: CalendarPlusIcon,
      any: "Any time",
      custom: true,
      options: DATE_PRESETS
    }
  ];
  // Q6: the first two filters get their own button; the rest go behind "More filters"
  const SHOWN = 2;

  const columns = new ColumnVisibility("prototype-divisions-b", [
    { id: "name", label: "Name", hideable: false },
    { id: "code", label: "Code" },
    { id: "description", label: "Description" },
    { id: "updatedAt", label: "Updated" }
  ]);
  onMount(() => columns.restore());

  const params = $derived(page.url.searchParams);
  const inTrash = $derived(data.query.trashed === "only");
  const sort = $derived({ sort: data.query.sort, dir: data.query.dir });
  const valueOf = (key: string) => params.get(key);
  const activeCount = $derived(FILTERS.filter((f) => valueOf(f.key)).length);
  const filtered = $derived(Boolean(data.query.search) || activeCount > 0);
  const of = $derived(inTrash ? data.trashCount : data.allCount);
  const href = (changes: Record<string, string | null>) => resolve(listHref(base, params, changes));
  const clearHref = $derived(
    href({ search: null, ...Object.fromEntries(FILTERS.map((f) => [f.key, null])) })
  );
  const resetFiltersHref = $derived(href(Object.fromEntries(FILTERS.map((f) => [f.key, null]))));
  // a choice in the Filter popover applies at once; the popover stays open for the next one
  const choose = (key: string, value: string | null) =>
    goto(href({ [key]: value }), { noScroll: true, keepFocus: true });
  // Round 13: "1 division", "12 divisions"; in the Trash "1 deleted division"
  const noun = (n: number) => `${inTrash ? "deleted " : ""}${n === 1 ? "division" : "divisions"}`;
  // Round 13: a row action's hover must stand out from the hovered row, which is already the
  // ghost button's grey: it lifts to the page colour with a hairline instead
  // Round 15: which columns give way as the card narrows; `@container/list` is the card
  const FOLD = $derived({
    card: responsive && "@container/list",
    description: responsive && "@max-2xl/list:hidden",
    meta: responsive && "@max-lg/list:hidden",
    name:
      responsive &&
      (middle === "desc"
        ? "@max-2xl/list:w-full @max-2xl/list:max-w-0 @max-2xl/list:min-w-[20ch]"
        : "@max-lg/list:w-full @max-lg/list:max-w-none"),
    updated: responsive && cn("@max-lg/list:hidden", middle === "date" && "@max-2xl/list:w-full")
  });
  // Round 17: the toolbar buttons fold to icons when the card is narrow
  const TOOL = $derived({
    button:
      compactTools && "relative @max-2xl/list:w-8 @max-2xl/list:justify-center @max-2xl/list:px-0!",
    label: compactTools && "@max-2xl/list:sr-only",
    badge:
      compactTools &&
      "@max-2xl/list:absolute @max-2xl/list:-top-1.5 @max-2xl/list:-right-1.5 @max-2xl/list:h-4 @max-2xl/list:min-w-4 @max-2xl/list:px-1 @max-2xl/list:text-[0.65rem] @max-2xl/list:ring-2 @max-2xl/list:ring-background"
  });
  // Round 20: the sort menu's choices, each a column and a direction
  const SORTS = $derived([
    { sort: "name", dir: "asc", label: "Name, A–Z" },
    { sort: "name", dir: "desc", label: "Name, Z–A" },
    { sort: "code", dir: "asc", label: "Code, A–Z" },
    { sort: "code", dir: "desc", label: "Code, Z–A" },
    {
      sort: "updatedAt",
      dir: "desc",
      label: inTrash ? "Deleted, newest first" : "Updated, newest first"
    },
    {
      sort: "updatedAt",
      dir: "asc",
      label: inTrash ? "Deleted, oldest first" : "Updated, oldest first"
    }
  ]);
  const sortLabel = $derived(
    SORTS.find((o) => o.sort === data.query.sort && o.dir === data.query.dir)?.label ?? "Name, A–Z"
  );
  function pickSort(value: string) {
    const [sortKey, dir] = value.split(":");
    const isDefault = sortKey === "name" && dir === "asc";
    goto(href({ sort: isDefault ? null : sortKey!, dir: isDefault ? null : dir! }), {
      noScroll: true,
      keepFocus: true
    });
  }
  // Round 22: the light-mode skins for the search field and the toolbar buttons
  const MID = "not-dark:border-[color-mix(in_oklab,var(--input)_45%,var(--border))]";
  const TONE = $derived(
    {
      now: { search: "", tool: "" },
      a: {
        search: "not-dark:bg-background not-dark:border-border not-dark:hover:border-input",
        tool: ""
      },
      b: { search: "", tool: "not-dark:border-input not-dark:bg-transparent" },
      c: { search: cn("not-dark:bg-background", MID), tool: MID }
    }[toolTone]
  );
  // Round 23: scaled corners for the page's controls; panels are portalled and keep their own
  const RADIUS = $derived(
    radius === "scaled" &&
      "[&_:is([data-slot=button],[data-slot=input],[data-chip])]:rounded-md pointer-coarse:[&_:is([data-slot=button],[data-slot=input],[data-chip])]:rounded-[11px]"
  );
  const ROW_ACTION =
    "hover:bg-background dark:hover:bg-background hover:ring-border hover:text-foreground hover:shadow-xs hover:ring-1";
  const fits = $derived(data.divisions.total <= data.divisions.perPage);

  let sheetOpen = $state(false);

  // Round 5: the Filter panel. Values are checkboxes: none ticked means any, several are
  // joined with commas (Q12). Dates are a preset or a custom `from..to` range.
  let panelOpen = $state(false);
  let customFor = $state<string | null>(null);
  const selected = (filter: Filter) => (valueOf(filter.key) ?? "").split(",").filter(Boolean);
  function toggle(filter: Filter, value: string, on: boolean) {
    const now = selected(filter);
    const next = filter.options
      .map((o) => o.value)
      .filter((v) => (v === value ? on : now.includes(v)));
    choose(filter.key, next.join(",") || null);
  }
  // Round 6: one calendar at a time. `customFor` is the date filter whose calendar is open;
  // a custom range already in use shows as its dates and a Change link instead
  const hasRange = (filter: Filter) => {
    const value = valueOf(filter.key);
    return Boolean(value && !filter.options.some((o) => o.value === value));
  };
  const isCustom = (filter: Filter) => customFor === filter.key || hasRange(filter);
  function pickPreset(filter: Filter, value: string | null) {
    customFor = null;
    choose(filter.key, value);
  }
  function calendarValue(filter: Filter): DateRange | undefined {
    const range = dateRange(valueOf(filter.key));
    return range ? { start: parseDate(range[0]), end: parseDate(range[1]) } : undefined;
  }
  // a custom range applies once both ends are picked
  function pickRange(filter: Filter, range: DateRange) {
    if (!range.start || !range.end) return;
    customFor = null;
    choose(filter.key, `${range.start}..${range.end}`);
  }
  // Round 7: the picker beside the panel. Presets apply at once and close it; a custom range is
  // a draft on the calendar until Apply.
  let pickerFor = $state<string | null>(null);
  let draft = $state<DateRange | undefined>(undefined);
  function openPicker(filter: Filter, open: boolean) {
    if (open) {
      pickerFor = filter.key;
      draft = calendarValue(filter);
    } else if (pickerFor === filter.key) pickerFor = null;
  }
  // Round 8: only the top layer hears an outside click, so the picker passes it on: a click
  // outside both closes both; a click on the panel closes the picker alone; Esc peels one layer
  function closeAllOutside(event: PointerEvent) {
    if (!(event.target as Element | null)?.closest("[data-filter-panel]")) dismissPanel();
  }
  // A click that only closes the filters must not also open the row beneath it (Q2). The
  // popover reports an outside click after the row has handled it, so the press is caught
  // on its way down instead.
  let dismissing = false;
  function dismissPanel() {
    panelOpen = false;
  }
  // Round 9: a panel opens on its first control, not on the Reset link in its header
  function focusFirstControl(event: Event) {
    event.preventDefault();
    const panel = [...document.querySelectorAll("[data-slot=popover-content]")].at(-1);
    panel?.querySelector<HTMLElement>("[data-slot=checkbox], [data-slot=filter-date-row]")?.focus();
  }
  // Round 9: Reset in the Columns panel shows every column again
  const hiddenColumns = $derived(columns.columns.filter((c) => !columns.visible(c.id)).length);
  const showAllColumns = () =>
    columns.columns.forEach((c) => columns.hideable(c.id) && columns.set(c.id, true));

  // Round 10: the View panel. Rows per page moves here from the footer, which keeps only the
  // page links; Reset brings back every column and the default page size.
  const perPage = $derived(data.divisions.perPage);
  // Round 21: the card's width, for what the View panel (portalled, so outside the card's
  // container queries) offers: Sort by replaces Columns once rows fold to two lines
  let cardWidth = $state(0);
  const folded = $derived(sortInView && cardWidth > 0 && cardWidth < 512);
  const sortChanged = $derived(data.query.sort !== "name" || data.query.dir !== "asc");
  const viewChanged = $derived(
    hiddenColumns > 0 || perPage !== DEFAULT_PER_PAGE || (folded && sortChanged)
  );
  function resetView() {
    showAllColumns();
    goto(href({ perPage: null, ...(folded ? { sort: null, dir: null } : {}) }), {
      noScroll: true,
      keepFocus: true
    });
  }

  // Round 10: row shortcuts. E edits, D deactivates, A activates, ⌫ deletes, R restores. They
  // act on the row under the pointer or holding focus, and inside an open row menu; never
  // while typing or while another layer is open.
  type Action = "edit" | "activate" | "deactivate" | "delete" | "restore";
  const KEYS: Record<string, Action> = {
    e: "edit",
    a: "activate",
    d: "deactivate",
    Backspace: "delete",
    Delete: "delete",
    r: "restore"
  };
  let menuFor = $state<string | null>(null);
  let hovered = $state<Division | null>(null);
  function run(action: Action, division: Division): boolean {
    if (inTrash) {
      if (action !== "restore") return false;
      stub(`Restore ${division.name}`)();
      return true;
    }
    if (action === "edit") stub(`Edit ${division.name}`)();
    else if (action === "delete") stub(`Delete ${division.name}`)();
    else if (action === "activate" && !isActive(division)) flip(division);
    else if (action === "deactivate" && isActive(division)) flip(division);
    else return false;
    return true;
  }
  function actionFor(event: KeyboardEvent): Action | undefined {
    if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
    return KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  }
  function onkeydown(event: KeyboardEvent) {
    if (!view || panelOpen || menuFor || opened) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog']"
      )
    )
      return;
    const action = actionFor(event);
    if (!action) return;
    const id = target?.closest<HTMLElement>("tr[data-id]")?.dataset.id;
    const division = data.divisions.items.find((d) => d.id === id) ?? hovered;
    if (division && run(action, division)) event.preventDefault();
  }
  function menuKeydown(event: KeyboardEvent, division: Division) {
    if (!view) return;
    const action = actionFor(event);
    if (!action || !run(action, division)) return;
    event.preventDefault();
    event.stopPropagation();
    menuFor = null;
  }

  function onpointerdowncapture(event: PointerEvent) {
    if (!panelOpen) return;
    if ((event.target as Element | null)?.closest("[data-slot=popover-content]")) return;
    dismissing = true;
    setTimeout(() => (dismissing = false), 400);
  }
  function applyPreset(filter: Filter, value: string | null) {
    pickerFor = null;
    choose(filter.key, value);
  }
  function applyDraft(filter: Filter) {
    if (!draft?.start || !draft.end) return;
    pickerFor = null;
    choose(filter.key, `${draft.start}..${draft.end}`);
  }

  // what the chip and the date caption say: "Active, Inactive", "Last 7 days", "2 – 5 Jan 2026"
  function describe(filter: Filter): string {
    if (filter.kind === "values")
      return selected(filter)
        .map((v) => filter.options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    const value = valueOf(filter.key);
    const preset = filter.options.find((o) => o.value === value);
    if (preset) return preset.label;
    const range = dateRange(value);
    return range ? formatRange(range) : "";
  }
  let opened = $state<Division | null>(null);

  // Q2: the whole row opens the record; the name stays a real link for new tabs and no-JS
  function openRow(event: MouseEvent, division: Division) {
    if (dismissing) return;
    if ((event.target as HTMLElement).closest("a, button, [role='menuitem']")) return;
    opened = division;
  }
  function openName(event: MouseEvent, division: Division) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (dismissing) return;
    opened = division;
  }
  const stub = (what: string) => () => toast.info(`Prototype: ${what}`);

  // Activate/Deactivate flips the row in place, with an undo, standing in for the real mutation
  const flipped = new SvelteSet<string>();
  const isActive = (division: Division) => division.isActive !== flipped.has(division.id);
  function flip(division: Division) {
    const flipTo = () =>
      flipped.has(division.id) ? flipped.delete(division.id) : flipped.add(division.id);
    flipTo();
    toast.success(`${isActive(division) ? "Activated" : "Deactivated"} ${division.name}`, {
      action: { label: "Undo", onClick: flipTo }
    });
  }

  // Round 3: the in-use chip leaves `secondary` (a cool lavender that sits off the warm surfaces).
  // `badge` is the count on the Filter button, which itself stays an outline button.
  const CHIP: Record<
    Chip,
    { chip: string; part: string; icon: string; label: string; seam: string; badge: string }
  > = {
    green: {
      chip: "bg-primary/10 ring-primary/30 text-foreground ring-1 ring-inset dark:bg-primary/15",
      part: "hover:bg-primary/10 aria-expanded:bg-primary/10",
      icon: "text-primary",
      label: "text-muted-foreground",
      seam: "border-primary/25",
      badge: "bg-primary text-primary-foreground"
    },
    outline: {
      chip: "bg-background ring-border text-foreground shadow-xs ring-1 ring-inset dark:bg-input/30",
      part: "hover:bg-muted aria-expanded:bg-muted",
      icon: "text-primary",
      label: "text-muted-foreground",
      seam: "border-border",
      badge: "bg-foreground text-background"
    },
    navy: {
      chip: "bg-foreground text-background",
      part: "hover:bg-background/15 aria-expanded:bg-background/15",
      icon: "text-background/70",
      label: "text-background/70",
      seam: "border-background/20",
      badge: "bg-foreground text-background"
    }
  };
  const look = $derived(CHIP[chip]);

  const chosenOf = (filter: Filter) => filter.options.find((o) => o.value === valueOf(filter.key));
  const VIEWS = $derived([
    { name: "All", trashed: null, current: !inTrash, count: data.views.all },
    { name: "Trash", trashed: "only", current: inTrash, count: data.views.trash }
  ]);

  // The row's own background faded in over 150ms (`transition-colors` on Table.Row) while the
  // pinned cells, painted separately, switched at once: the middle lagged the edges. No fade,
  // and the pinned cells follow every state that paints the row, the open menu included.
  const ROW = "cursor-pointer transition-none hover:bg-muted has-aria-expanded:bg-muted";
  const PINNED_BG = "bg-card [tr:hover>&]:bg-muted [tr:has([aria-expanded=true])>&]:bg-muted";

  const TILE = {
    solid: "text-white",
    tint: "bg-[color-mix(in_oklab,var(--tile)_14%,transparent)] text-(--tile) dark:bg-[color-mix(in_oklab,var(--tile)_30%,transparent)] dark:text-[color-mix(in_oklab,var(--tile)_50%,white)]",
    glyph: "text-(--tile) dark:text-[color-mix(in_oklab,var(--tile)_50%,white)]"
  };
</script>

<svelte:window {onpointerdowncapture} {onkeydown} />

<!-- a key cap; Backspace draws lucide's backspace-key glyph, the ⌫ character renders too small -->
{#snippet key(label: string)}
  {#if view}
    <DropdownMenu.Shortcut
      ><kbd
        class="border-border inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[0.7rem]"
        >{#if label === "Backspace"}<DeleteIcon
            aria-label="Backspace"
            class="size-3.5"
          />{:else}{label}{/if}</kbd
      ></DropdownMenu.Shortcut
    >
  {/if}
{/snippet}

<!-- Round 11: the search is a condition too, so it gets a chip like the filters -->
{#snippet searchChip()}
  <div
    data-chip
    class={cn(
      "inline-flex h-8 items-stretch overflow-hidden rounded-md text-sm pointer-coarse:h-11",
      look.chip
    )}
  >
    <button
      type="button"
      data-slot="filter-chip"
      class={cn(
        "inline-flex max-w-64 items-center gap-1.5 pr-2 pl-2 font-medium outline-none",
        look.part
      )}
      onclick={() => document.querySelector<HTMLInputElement>("input[type=search]")?.focus()}
    >
      <SearchIcon aria-hidden="true" class={cn("size-4 shrink-0", look.icon)} />
      <span class={cn("font-normal", look.label)}>Search</span><span class="truncate"
        >“{data.query.search}”</span
      >
    </button>
    <a
      href={href({ search: null })}
      data-sveltekit-noscroll
      aria-label="Clear the search"
      class={cn(
        "inline-flex w-7 items-center justify-center border-l pointer-coarse:w-11",
        look.part,
        look.seam
      )}><XIcon aria-hidden="true" class="size-3.5" /></a
    >
  </div>
{/snippet}

<!-- Round 14: the searched text, marked where it matches, so a row says why it is listed -->
{#snippet marked(text: string)}
  {@const term = searchBox ? (data.query.search ?? "").trim() : ""}
  {#if term}
    {@const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"))}
    {#each parts as part, index (index)}{#if index % 2}<mark
          class="bg-primary/15 text-foreground dark:bg-primary/25 rounded-[3px]">{part}</mark
        >{:else}{part}{/if}{/each}
  {:else}
    {text}
  {/if}
{/snippet}

{#snippet columnRows()}
  {#each columns.columns as column (column.id)}
    {#if columns.hideable(column.id)}
      <label
        data-slot="filter-option"
        class="hover:bg-muted flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm pointer-coarse:h-11"
      >
        <Checkbox
          checked={columns.visible(column.id)}
          onCheckedChange={(on) => columns.set(column.id, on)}
        />
        {column.label}
      </label>
    {:else}
      <div class="text-muted-foreground flex h-8 items-center gap-2.5 px-2 text-sm">
        <LockIcon aria-hidden="true" class="size-4" />{column.label}
        <span class="ml-auto text-xs">Always shown</span>
      </div>
    {/if}
  {/each}
{/snippet}

<!-- Round 10: View — the columns and the page size, the footer keeps only the page links -->
{#snippet viewPanel()}
  <Popover.Root>
    <!-- Round 16: triggers render through Button, so touch screens give them 44px like the
         search field (app.css sizes [data-slot=button] and [data-slot=input] for coarse pointers) -->
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          data-slot="button"
          variant="outline"
          class={cn("relative", !sortInView && "max-sm:hidden", TOOL.button, TONE.tool)}
          aria-label={viewChanged ? "View, changed" : "View"}
          title={compactTools ? "View" : undefined}
        >
          <Settings2Icon aria-hidden="true" data-icon="inline-start" /><span
            class={TOOL.label || undefined}>View</span
          >
          {#if viewChanged}
            <span
              aria-hidden="true"
              class="bg-foreground ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
            ></span>
          {/if}
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content
      align="end"
      class="w-64 gap-0 p-0"
      role="dialog"
      aria-label="View"
      onOpenAutoFocus={focusFirstControl}
    >
      <div class="flex h-11 items-center justify-between px-4">
        <h2 class="text-sm font-semibold">View</h2>
        {#if viewChanged}
          <button
            type="button"
            data-slot="view-reset"
            class="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            onclick={resetView}>Reset</button
          >
        {/if}
      </div>
      {#if folded}
        <section aria-labelledby="view-sort" class="border-border border-t px-4 py-3">
          <h3
            id="view-sort"
            class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium"
          >
            <ArrowUpDownIcon aria-hidden="true" class="size-3.5" />Sort by
          </h3>
          <div class="-mx-2 flex flex-col">
            {#each SORTS as option (`${option.sort}:${option.dir}`)}
              {@const on = option.sort === data.query.sort && option.dir === data.query.dir}
              <button
                type="button"
                data-slot="view-sort"
                aria-pressed={on}
                onclick={() => pickSort(`${option.sort}:${option.dir}`)}
                class={cn(
                  "hover:bg-muted flex h-8 items-center justify-between rounded-md px-2 text-sm pointer-coarse:h-11",
                  on && "font-medium"
                )}
              >
                {option.label}
                {#if on}<CheckIcon aria-hidden="true" class="text-primary size-4" />{/if}
              </button>
            {/each}
          </div>
        </section>
      {:else}
        <section aria-labelledby="view-columns" class="border-border border-t px-4 py-3">
          <h3
            id="view-columns"
            class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium"
          >
            <Columns3Icon aria-hidden="true" class="size-3.5" />Columns
          </h3>
          <div class="-mx-2 flex flex-col">{@render columnRows()}</div>
        </section>
      {/if}
      <section aria-labelledby="view-rows" class="border-border border-t px-4 py-3">
        <h3
          id="view-rows"
          class="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium"
        >
          <Rows3Icon aria-hidden="true" class="size-3.5" />Rows per page
        </h3>
        <div class="flex gap-1.5">
          {#each PER_PAGE_OPTIONS as size (size)}
            <a
              href={href({ perPage: size === DEFAULT_PER_PAGE ? null : String(size) })}
              data-sveltekit-noscroll
              data-sveltekit-keepfocus
              aria-current={perPage === size ? "true" : undefined}
              class={cn(
                "inline-flex h-7 flex-1 items-center justify-center rounded-md text-sm tabular-nums ring-1 ring-inset pointer-coarse:h-10",
                perPage === size
                  ? "bg-primary/10 ring-primary/30 text-foreground dark:bg-primary/15 font-medium"
                  : "ring-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>{size}</a
            >
          {/each}
        </div>
      </section>
    </Popover.Content>
  </Popover.Root>
{/snippet}

<!-- Round 10: the footer without the page-size control -->
{#snippet pager()}
  {@const list = data.divisions}
  {@const totalPages = Math.max(1, Math.ceil(list.total / list.perPage))}
  {@const shown = showingRange(list)}
  {@const link =
    "inline-flex size-8 items-center justify-center rounded-md text-sm tabular-nums pointer-coarse:size-11"}
  <nav aria-label="Pages" class="flex items-center justify-between gap-3">
    <p class="text-muted-foreground text-sm tabular-nums">
      {shown.from}–{shown.to} of {list.total}
      {noun(list.total)}
    </p>
    <div class="flex items-center gap-1">
      <a
        href={href({ page: String(Math.max(1, list.page - 1)) })}
        data-sveltekit-noscroll
        aria-label="Previous page"
        aria-disabled={list.page <= 1}
        class={cn(link, "hover:bg-muted", list.page <= 1 && "pointer-events-none opacity-40")}
        ><ChevronLeftIcon aria-hidden="true" class="size-4" /></a
      >
      {#each pageWindow(list.page, totalPages) as item, index (index)}
        {#if item === "gap"}
          <span class={cn(link, "text-muted-foreground")}>…</span>
        {:else}
          <a
            href={href({ page: item === 1 ? null : String(item) })}
            data-sveltekit-noscroll
            aria-current={item === list.page ? "page" : undefined}
            class={cn(
              link,
              item === list.page
                ? "bg-primary/10 ring-primary/30 dark:bg-primary/15 font-medium ring-1 ring-inset"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>{item}</a
          >
        {/if}
      {/each}
      <a
        href={href({ page: String(Math.min(totalPages, list.page + 1)) })}
        data-sveltekit-noscroll
        aria-label="Next page"
        aria-disabled={list.page >= totalPages}
        class={cn(
          link,
          "hover:bg-muted",
          list.page >= totalPages && "pointer-events-none opacity-40"
        )}><ChevronRightIcon aria-hidden="true" class="size-4" /></a
      >
    </div>
  </nav>
{/snippet}

{#snippet filterButton(filter: Filter)}
  {@const chosen = chosenOf(filter)}
  {#if chosen}
    <!-- a filter in use: one chip, the menu to change it and an × to drop it -->
    <div
      class={cn(
        "inline-flex h-8 items-stretch overflow-hidden rounded-md text-sm pointer-coarse:h-11",
        look.chip
      )}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class={cn(
            "inline-flex items-center gap-1.5 pr-2 pl-2 font-medium outline-none",
            look.part
          )}
        >
          <filter.icon aria-hidden="true" class={cn("size-4", look.icon)} />
          <span class={cn("font-normal", look.label)}>{filter.label}</span>{chosen.label}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" class="w-52">
          {@render optionItems(filter)}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <a
        href={href({ [filter.key]: null })}
        data-sveltekit-noscroll
        aria-label="Clear filter {filter.label}"
        class={cn(
          "inline-flex w-7 items-center justify-center border-l pointer-coarse:w-11",
          look.part,
          look.seam
        )}><XIcon aria-hidden="true" class="size-3.5" /></a
      >
    </div>
  {:else}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class={buttonVariants({ variant: "outline" })}>
        {filter.label}<ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="w-52">
        {@render optionItems(filter)}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
{/snippet}

{#snippet countBadge(extra: string | false = false)}
  {#if activeCount}
    <span
      class={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
        look.badge,
        extra
      )}>{activeCount}<span class="sr-only"> in use</span></span
    >
  {/if}
{/snippet}

{#snippet optionItems(filter: Filter)}
  {#each [{ value: null, label: filter.any }, ...filter.options] as option (option.value)}
    <DropdownMenu.Item>
      {#snippet child({ props })}
        <a {...props} href={href({ [filter.key]: option.value })} data-sveltekit-noscroll>
          <CheckIcon
            aria-hidden="true"
            class={cn("size-4", valueOf(filter.key) !== option.value && "invisible")}
          />{option.label}
        </a>
      {/snippet}
    </DropdownMenu.Item>
  {/each}
{/snippet}

{#snippet segmented()}
  <nav aria-label="Division views" class="bg-muted inline-flex h-8 items-center rounded-lg p-0.5">
    {#each VIEWS as view (view.name)}
      <a
        href={href({ trashed: view.trashed })}
        data-sveltekit-noscroll
        aria-current={view.current ? "page" : undefined}
        class={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium pointer-coarse:h-10",
          view.current
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {view.name}
        {#if view.trashed}
          <span class="text-muted-foreground text-xs tabular-nums">{view.count}</span>
        {/if}
      </a>
    {/each}
  </nav>
{/snippet}

{#snippet search(cls: string)}
  {#if searchBox}
    <SearchBox
      {base}
      label="Search divisions"
      placeholder="Search name, code or description"
      shortPlaceholder="Search divisions"
      inputClass={TONE.search}
      class={cls}
    />
  {:else}
    <ListSearch
      {base}
      label="Search divisions"
      placeholder="Search name, code or description"
      class={cls}
    />
  {/if}
{/snippet}

{#snippet statusLine()}
  {#if filtered}
    <p role="status" class="text-muted-foreground hidden text-sm tabular-nums sm:block">
      {data.divisions.total} of {of}
      {noun(of)} ·
      <a
        href={clearHref}
        data-sveltekit-noscroll
        class="text-foreground underline-offset-4 hover:underline">Clear all</a
      >
    </p>
  {/if}
{/snippet}

<!-- C2, C3: one Filter button. Round 4: one popover, a section per filter, no submenus;
     a choice applies at once and the popover stays open -->
{#snippet filterMenu()}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class={cn(buttonVariants({ variant: "outline" }), "max-sm:hidden")}>
      <ListFilterIcon aria-hidden="true" data-icon="inline-start" />Filter{@render countBadge()}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-56">
      {#each FILTERS as filter, index (filter.key)}
        {#if index > 0}<DropdownMenu.Separator />{/if}
        <DropdownMenu.RadioGroup
          value={valueOf(filter.key) ?? ""}
          onValueChange={(value) => choose(filter.key, value || null)}
        >
          <DropdownMenu.GroupHeading class="flex items-center gap-1.5">
            <filter.icon aria-hidden="true" class="size-3.5" />{filter.label}
          </DropdownMenu.GroupHeading>
          {#each [{ value: "", label: filter.any }, ...filter.options] as option (option.value)}
            <DropdownMenu.RadioItem value={option.value} closeOnSelect={false}
              >{option.label}</DropdownMenu.RadioItem
            >
          {/each}
        </DropdownMenu.RadioGroup>
        {#if filter.custom}
          <DropdownMenu.Item onSelect={stub(`a date-range picker for ${filter.label}`)}
            >Custom range…</DropdownMenu.Item
          >
        {/if}
      {/each}
      {#if activeCount}
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => goto(resetFiltersHref, { noScroll: true })}>
          <XIcon aria-hidden="true" />Reset filters
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

<!-- the filters in use, each still a menu to change it and an × to drop it -->
{#snippet chips()}
  {#each FILTERS.filter((f) => valueOf(f.key)) as filter (filter.key)}
    {#if toolbar === "card"}
      {@render panelChip(filter)}
    {:else}
      {@render filterButton(filter)}
    {/if}
  {/each}
{/snippet}

<!-- Round 5: a chip in use; clicking it opens the Filter panel, × drops it -->
{#snippet panelChip(filter: Filter)}
  <div
    data-chip
    class={cn(
      "inline-flex h-8 items-stretch overflow-hidden rounded-md text-sm pointer-coarse:h-11",
      look.chip
    )}
  >
    <button
      type="button"
      data-slot="filter-chip"
      class={cn("inline-flex items-center gap-1.5 pr-2 pl-2 font-medium outline-none", look.part)}
      onclick={() => (panelOpen = true)}
    >
      <filter.icon aria-hidden="true" class={cn("size-4", look.icon)} />
      <span class={cn("font-normal", look.label)}>{filter.label}</span>{describe(filter)}
    </button>
    <a
      href={href({ [filter.key]: null })}
      data-sveltekit-noscroll
      aria-label="Clear filter {filter.label}"
      class={cn(
        "inline-flex w-7 items-center justify-center border-l pointer-coarse:w-11",
        look.part,
        look.seam
      )}><XIcon aria-hidden="true" class="size-3.5" /></a
    >
  </div>
{/snippet}

<!-- Round 5: the Filter panel, a popover on desktop and the same body in the phone sheet -->
{#snippet filterPanel()}
  <Popover.Root bind:open={panelOpen}>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          data-slot="button"
          variant="outline"
          class={cn("max-sm:hidden", TOOL.button, TONE.tool)}
          title={compactTools ? "Filter" : undefined}
        >
          <ListFilterIcon aria-hidden="true" data-icon="inline-start" /><span
            class={TOOL.label || undefined}>Filter</span
          >{@render countBadge(TOOL.badge)}
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content
      align="end"
      class="max-h-(--bits-floating-available-height) w-80 gap-0 overflow-y-auto p-0"
      role="dialog"
      aria-label="Filters"
      data-filter-panel
      onInteractOutside={dismissPanel}
      onOpenAutoFocus={focusFirstControl}
    >
      {@render filterBody(dates === "beside")}
    </Popover.Content>
  </Popover.Root>
{/snippet}

<!-- Round 7: a date filter as one row; its picker opens beside the panel, presets on the left
     with their dates, the calendar on the right -->
{#snippet datePicker(filter: Filter)}
  {@const value = valueOf(filter.key)}
  <Popover.Root open={pickerFor === filter.key} onOpenChange={(open) => openPicker(filter, open)}>
    <Popover.Trigger
      data-slot="filter-date-row"
      class="hover:bg-muted aria-expanded:bg-muted -mx-2 flex h-9 w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 text-sm pointer-coarse:h-11"
    >
      <filter.icon aria-hidden="true" class="text-muted-foreground size-4" />{filter.label}
      <span
        class={cn(
          "ml-auto truncate",
          value ? "text-foreground font-medium" : "text-muted-foreground"
        )}>{value ? describe(filter) : filter.any}</span
      >
      <ChevronRightIcon aria-hidden="true" class="text-muted-foreground size-4" />
    </Popover.Trigger>
    <Popover.Content
      side="left"
      align="start"
      sideOffset={12}
      class="w-auto flex-row gap-0 overflow-hidden p-0"
      role="dialog"
      aria-label="{filter.label} dates"
      onInteractOutside={closeAllOutside}
    >
      <div class="border-border bg-muted/40 flex w-64 flex-col gap-0.5 border-r p-2">
        {#each [{ value: null, label: filter.any }, ...filter.options] as option (option.value)}
          {@const range = option.value ? PRESET_RANGE[option.value] : null}
          {@const on = value === option.value}
          <button
            type="button"
            data-slot="filter-preset"
            aria-pressed={on}
            onclick={() => applyPreset(filter, option.value)}
            class={cn(
              "flex h-9 items-center justify-between gap-3 rounded-md px-2.5 text-sm",
              on
                ? "bg-primary/10 ring-primary/30 dark:bg-primary/15 font-medium ring-1 ring-inset"
                : "hover:bg-muted"
            )}
          >
            {option.label}
            {#if range}
              <span class="text-muted-foreground text-xs font-normal tabular-nums"
                >{formatRange(range)}</span
              >
            {/if}
          </button>
        {/each}
      </div>
      <div class="flex flex-col">
        <RangeCalendar
          bind:value={draft}
          placeholder={parseDate(TODAY)}
          maxValue={parseDate(TODAY)}
          weekStartsOn={1}
          class="p-3 [--cell-size:--spacing(9)]"
        />
        <div class="border-border flex items-center justify-between gap-3 border-t p-3">
          <span class="text-muted-foreground text-xs tabular-nums">
            {draft?.start && draft.end
              ? formatRange([draft.start.toString(), draft.end.toString()])
              : "Pick a start and an end"}
          </span>
          <div class="flex gap-2">
            <Button variant="ghost" onclick={() => (pickerFor = null)}>Cancel</Button>
            <Button disabled={!draft?.start || !draft.end} onclick={() => applyDraft(filter)}
              >Apply</Button
            >
          </div>
        </div>
      </div>
    </Popover.Content>
  </Popover.Root>
{/snippet}

{#snippet filterBody(beside: boolean)}
  <div class="flex h-11 items-center justify-between px-4 in-data-[slot=sheet-content]:pr-14">
    <h2 class="text-sm font-semibold">Filters</h2>
    {#if activeCount}
      <a
        href={resetFiltersHref}
        data-sveltekit-noscroll
        onclick={() => (customFor = null)}
        class="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >Reset</a
      >
    {/if}
  </div>
  {#each FILTERS as filter (filter.key)}
    {@const row = beside && filter.kind === "date"}
    <section
      aria-labelledby="filter-{filter.key}"
      class={cn("border-border border-t px-4", row ? "py-1.5" : "py-3")}
    >
      <h3
        id="filter-{filter.key}"
        class={cn(
          "text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium",
          row && "sr-only"
        )}
      >
        <filter.icon aria-hidden="true" class="size-3.5" />{filter.label}
      </h3>
      {#if row}
        {@render datePicker(filter)}
      {:else if filter.kind === "values"}
        <div class="-mx-2 flex flex-col">
          {#each filter.options as option (option.value)}
            {@const count = data.facets[filter.key]?.[option.value] ?? 0}
            <label
              data-slot="filter-option"
              class="hover:bg-muted flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm pointer-coarse:h-11"
            >
              <Checkbox
                checked={selected(filter).includes(option.value)}
                onCheckedChange={(on) => toggle(filter, option.value, on)}
              />
              {option.label}
              <span class="text-muted-foreground ml-auto text-xs tabular-nums">{count}</span>
            </label>
          {/each}
        </div>
      {:else}
        {@const value = valueOf(filter.key)}
        <div class="flex flex-wrap gap-1.5">
          {#each [{ value: null, label: filter.any }, ...filter.options] as option (option.value)}
            {@const pressed = !isCustom(filter) && value === option.value}
            <button
              type="button"
              data-slot="filter-pill"
              aria-pressed={pressed}
              onclick={() => pickPreset(filter, option.value)}
              class={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm ring-1 ring-inset pointer-coarse:h-10",
                pressed
                  ? "bg-primary/10 ring-primary/30 text-foreground dark:bg-primary/15 font-medium"
                  : "ring-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          {/each}
          <button
            type="button"
            data-slot="filter-pill"
            aria-pressed={isCustom(filter)}
            onclick={() =>
              (customFor = customFor === filter.key && !hasRange(filter) ? null : filter.key)}
            class={cn(
              "inline-flex h-7 items-center rounded-md px-2.5 text-sm ring-1 ring-inset pointer-coarse:h-10",
              isCustom(filter)
                ? "bg-primary/10 ring-primary/30 text-foreground dark:bg-primary/15 font-medium"
                : "ring-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>Custom…</button
          >
        </div>
        {#if dateRange(value) && customFor !== filter.key}
          <p class="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs tabular-nums">
            {formatRange(dateRange(value)!)}
            {#if hasRange(filter)}
              ·
              <button
                type="button"
                data-slot="filter-change"
                class="text-foreground underline-offset-4 hover:underline"
                onclick={() => (customFor = filter.key)}>Change</button
              >
            {/if}
          </p>
        {/if}
        {#if customFor === filter.key}
          <RangeCalendar
            value={calendarValue(filter)}
            onValueChange={(range) => pickRange(filter, range)}
            placeholder={parseDate(TODAY)}
            maxValue={parseDate(TODAY)}
            weekStartsOn={1}
            class="-mx-1 mt-2 w-full p-0 [--cell-size:--spacing(9)]"
          />
        {/if}
      {/if}
    </section>
  {/each}
{/snippet}

<!-- Q15: on a phone, one Filters button; the sheet lists every option -->
{#snippet phoneFilters()}
  <Sheet.Root bind:open={sheetOpen}>
    <Sheet.Trigger>
      {#snippet child({ props })}
        {#if compactTools}
          <!-- Round 18: the phone's Filters is the tablet's icon button: the same funnel, the
               count in its corner, the name kept for screen readers -->
          <Button
            {...props}
            data-slot="button"
            variant="outline"
            size="icon"
            class={cn("relative sm:hidden", TONE.tool)}
            title="Filters"
          >
            <ListFilterIcon aria-hidden="true" /><span class="sr-only">Filters</span
            >{@render countBadge(
              "absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[0.65rem] ring-2 ring-background"
            )}
          </Button>
        {:else}
          <Button {...props} variant="outline" class="sm:hidden">
            <SlidersHorizontalIcon
              aria-hidden="true"
              data-icon="inline-start"
            />Filters{@render countBadge()}
          </Button>
        {/if}
      {/snippet}
    </Sheet.Trigger>
    <Sheet.Content side="bottom" class="max-h-[85svh] gap-0 overflow-y-auto rounded-t-xl">
      <Sheet.Title class="sr-only">Filters</Sheet.Title>
      {@render filterBody(false)}
      {#if filtered}
        <div class="border-border border-t p-4">
          <a
            href={clearHref}
            class={cn(buttonVariants({ variant: "outline" }), "w-full")}
            onclick={() => (sheetOpen = false)}
            >Clear all · {data.divisions.total} of {of} {noun(of)}</a
          >
        </div>
      {/if}
    </Sheet.Content>
  </Sheet.Root>
{/snippet}

<!-- Round 20: the shell's 24px page padding drops to 16px on tablets -->
<svelte:head>
  {#if tabletPadding}
    <style>
      @media (min-width: 640px) and (max-width: 1023.98px) {
        #main-content {
          padding: 1rem;
        }
      }
    </style>
  {/if}
</svelte:head>

<Page width="default" class={cn("flex flex-col gap-4", RADIUS)}>
  <!-- Q8, Q9: no description; a smaller title with the action on its row -->
  <header class="flex items-center justify-between gap-3">
    <h1 class="font-display text-2xl font-medium tracking-tight">Divisions</h1>
    <Button onclick={stub("New division")}>
      <PlusIcon aria-hidden="true" data-icon="inline-start" />New division
    </Button>
  </header>

  {#if toolbar === "row"}
    <!-- C1 One row: views, search, a button per filter, More filters, status, columns -->
    <div class="flex flex-wrap items-center gap-2">
      {@render segmented()}
      {@render search("max-sm:order-last max-sm:w-full sm:w-80")}
      <div class="hidden items-center gap-2 sm:flex">
        {#each FILTERS.slice(0, SHOWN) as filter (filter.key)}
          {@render filterButton(filter)}
        {/each}
        {#each FILTERS.slice(SHOWN).filter((f) => valueOf(f.key)) as filter (filter.key)}
          {@render filterButton(filter)}
        {/each}
        {#if FILTERS.slice(SHOWN).some((f) => !valueOf(f.key))}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger class={buttonVariants({ variant: "ghost" })}>
              <ListFilterIcon aria-hidden="true" data-icon="inline-start" />More filters
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" class="w-52">
              {#each FILTERS.slice(SHOWN).filter((f) => !valueOf(f.key)) as filter (filter.key)}
                <DropdownMenu.Group>
                  <DropdownMenu.GroupHeading>{filter.label}</DropdownMenu.GroupHeading>
                  {@render optionItems(filter)}
                </DropdownMenu.Group>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </div>
      <div class="ml-auto flex items-center gap-2">
        {@render statusLine()}
        {@render phoneFilters()}
        <ColumnsMenu {columns} />
      </div>
    </div>
  {:else if toolbar === "filter"}
    <!-- C2 Filter menu: a quiet row at rest; the filters in use drop to a second row -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        {@render search("max-sm:order-last max-sm:w-full sm:w-80")}
        {@render filterMenu()}
        <div class="ml-auto flex items-center gap-2">
          {@render segmented()}
          {@render phoneFilters()}
          <ColumnsMenu {columns} />
        </div>
      </div>
      {#if filtered}
        <div class="hidden flex-wrap items-center gap-2 sm:flex">
          {@render chips()}
          <div class="ml-auto">{@render statusLine()}</div>
        </div>
      {/if}
    </div>
  {:else if toolbar === "pills"}
    <!-- C4 Add-filter pills: views and search above; every filter a dashed pill below -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        {@render segmented()}
        <div class="ml-auto flex items-center gap-2 max-sm:w-full">
          {@render search("max-sm:flex-1 sm:w-80")}
          {@render phoneFilters()}
          <ColumnsMenu {columns} />
        </div>
      </div>
      <div class="hidden flex-wrap items-center gap-2 sm:flex">
        {#each FILTERS as filter (filter.key)}
          {#if chosenOf(filter)}
            {@render filterButton(filter)}
          {:else}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                class={cn(
                  buttonVariants({ variant: "outline" }),
                  "text-muted-foreground border-dashed shadow-none"
                )}
              >
                <CirclePlusIcon aria-hidden="true" data-icon="inline-start" />{filter.label}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" class="w-52"
                >{@render optionItems(filter)}</DropdownMenu.Content
              >
            </DropdownMenu.Root>
          {/if}
        {/each}
        <div class="ml-auto">{@render statusLine()}</div>
      </div>
    </div>
  {/if}

  {@const list = data.divisions}
  <div
    class={cn(
      "border-border bg-card relative overflow-hidden rounded-lg border",
      FOLD.card,
      radius === "scaled" && "rounded-xl"
    )}
    bind:clientWidth={cardWidth}
  >
    {#if toolbar === "card"}
      <!-- C3 In the card: the views are tabs on the table's own top edge, the controls beside them -->
      <div class="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3">
        <nav aria-label="Division views" class="-mb-px flex items-center gap-4 self-stretch">
          {#each VIEWS as view (view.name)}
            <a
              href={href({ trashed: view.trashed })}
              data-sveltekit-noscroll
              aria-current={view.current ? "page" : undefined}
              class={cn(
                "inline-flex h-12 items-center gap-1.5 border-b-2 text-sm font-medium",
                view.current
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {view.name}
              <span class="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums"
                >{view.count}</span
              >
            </a>
          {/each}
        </nav>
        <div
          class={cn(
            "ml-auto flex items-center gap-2 py-2 max-sm:w-full",
            responsive && "@max-3xl/list:w-full"
          )}
        >
          {@render search(
            responsive ? "flex-1 @3xl/list:w-80 @3xl/list:flex-none" : "max-sm:flex-1 sm:w-80"
          )}
          {@render filterPanel()}
          {@render phoneFilters()}
          {#if view}
            {@render viewPanel()}
          {:else}
            <!-- Round 9: Columns is a panel like Filter: a header with Reset, checkbox rows, and
               the pinned Name listed as locked so its absence from the choices is explained -->
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    data-slot="button"
                    variant="outline"
                    size="icon"
                    class="relative"
                    aria-label={hiddenColumns ? `Columns, ${hiddenColumns} hidden` : "Columns"}
                  >
                    <Columns3Icon aria-hidden="true" />
                    {#if hiddenColumns}
                      <span
                        aria-hidden="true"
                        class="bg-foreground ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
                      ></span>
                    {/if}
                  </Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content
                align="end"
                class="w-56 gap-0 p-0"
                role="dialog"
                aria-label="Columns"
                onOpenAutoFocus={focusFirstControl}
              >
                <div class="flex h-11 items-center justify-between px-4">
                  <h2 class="text-sm font-semibold">Columns</h2>
                  {#if hiddenColumns}
                    <button
                      type="button"
                      data-slot="columns-reset"
                      class="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                      onclick={showAllColumns}>Reset</button
                    >
                  {/if}
                </div>
                <div class="border-border flex flex-col border-t px-2 py-2">
                  {@render columnRows()}
                </div>
              </Popover.Content>
            </Popover.Root>
          {/if}
        </div>
      </div>
      {#if view && inTrash}
        <!-- Round 13: nothing leaves the Trash, so it says why and what Restore does -->
        <p
          class="border-border text-muted-foreground flex items-center gap-2 border-b px-3 py-2.5 text-sm"
        >
          <HistoryIcon aria-hidden="true" class="size-4 shrink-0" />
          Deleted divisions stay here for the audit trail. Restore one to use it again.
        </p>
      {/if}
      {#if filtered}
        <div
          class="bg-muted/40 border-border hidden flex-wrap items-center gap-2 border-b px-3 py-2 sm:flex"
        >
          {#if strip === "end"}
            {@render chips()}
            <div class="ml-auto">{@render statusLine()}</div>
          {:else}
            {#if strip === "lead"}
              <p role="status" class="text-muted-foreground mr-1 text-sm tabular-nums">
                {data.divisions.total} of {of}
              </p>
            {/if}
            {#if data.query.search}{@render searchChip()}{/if}
            {@render chips()}
            <a
              href={clearHref}
              data-sveltekit-noscroll
              data-slot="button"
              class={cn(
                buttonVariants({ variant: "ghost" }),
                "text-muted-foreground pointer-coarse:h-11"
              )}>Clear all</a
            >
          {/if}
        </div>
      {/if}
    {/if}
    {#if sortBar && list.items.length > 0}
      <!-- Round 20: the sort menu stands in for the header row once rows fold to two lines -->
      <div class="border-border hidden items-center border-b px-2 py-1.5 @max-lg/list:flex">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                data-slot="button"
                variant="ghost"
                size="sm"
                class="text-muted-foreground"
              >
                <ArrowUpDownIcon aria-hidden="true" data-icon="inline-start" />Sort:
                <span class="text-foreground font-medium">{sortLabel}</span>
                <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" class="w-56">
            <DropdownMenu.RadioGroup
              value={`${data.query.sort}:${data.query.dir}`}
              onValueChange={pickSort}
            >
              <DropdownMenu.GroupHeading>Sort by</DropdownMenu.GroupHeading>
              {#each SORTS as option (`${option.sort}:${option.dir}`)}
                <DropdownMenu.RadioItem value={`${option.sort}:${option.dir}`}
                  >{option.label}</DropdownMenu.RadioItem
                >
              {/each}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    {/if}
    {#if list.items.length === 0 && view && inTrash && !filtered}
      <EmptyState
        icon={Trash2Icon}
        title="The Trash is empty"
        description="A division you delete waits here, and you can restore it at any time."
      />
    {:else if list.items.length === 0}
      <EmptyState
        icon={SearchXIcon}
        title="No divisions match"
        description="Try another search, or clear the filters to see every division."
      >
        <a href={clearHref} class={buttonVariants({ variant: "outline" })}
          >Clear search and filters</a
        >
      </EmptyState>
    {:else}
      <Table.Root>
        <Table.Header class={cn((sortBar || sortInView) && "@max-lg/list:hidden")}>
          <Table.Row class="hover:bg-transparent">
            <SortableHead
              {base}
              column="name"
              label="Name"
              current={sort}
              class={cn(
                "bg-card pinned-start sticky left-0 z-10",
                columnClass("identity"),
                FOLD.name
              )}
            />
            {#if columns.visible("code")}
              <SortableHead
                {base}
                column="code"
                label="Code"
                current={sort}
                class={cn(columnClass("utility"), FOLD.meta)}
              />
            {/if}
            {#if columns.visible("description")}
              <!-- Q11: free text absorbs the spare width and truncates, down to ~16ch -->
              <Table.Head scope="col" class={cn("w-full max-w-0 min-w-[16ch]", FOLD.description)}
                >Description</Table.Head
              >
            {/if}
            {#if columns.visible("updatedAt")}
              <SortableHead
                {base}
                column="updatedAt"
                label={inTrash ? "Deleted" : "Updated"}
                current={sort}
                class={cn(columnClass("utility"), FOLD.updated)}
              />
            {/if}
            <Table.Head
              scope="col"
              class={cn("bg-card pinned-end sticky right-0 z-10", columnClass("utility"))}
              ><span class="sr-only">Actions</span></Table.Head
            >
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each list.items as division (division.id)}
            <Table.Row
              class={ROW}
              data-id={division.id}
              onclick={(e: MouseEvent) => openRow(e, division)}
              onmouseenter={() => (hovered = division)}
              onmouseleave={() => hovered === division && (hovered = null)}
            >
              <Table.Cell
                class={cn(
                  PINNED_BG,
                  "pinned-start sticky left-0 z-10 max-w-72",
                  columnClass("identity"),
                  FOLD.name
                )}
              >
                <div class="flex items-center gap-2.5">
                  <span
                    class={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md",
                      TILE[tile]
                    )}
                    style:--tile={division.colorHex}
                    style:background-color={tile === "solid" ? division.colorHex : undefined}
                  >
                    <HeroIcon
                      name={division.iconName}
                      class={tile === "glyph" ? "size-5" : "size-4"}
                    />
                  </span>
                  <div class="flex min-w-0 flex-col">
                    <div class="flex min-w-0 items-center gap-2.5">
                      <a
                        href="#{division.code}"
                        class="truncate font-medium hover:underline"
                        onclick={(e) => openName(e, division)}>{@render marked(division.name)}</a
                      >
                      {#if !isActive(division)}
                        <!-- Q1: only the exception gets a pill -->
                        <StatusPill status="Inactive" class="shrink-0" />
                      {/if}
                    </div>
                    {#if responsive && middle === "desc" && columns.visible("description") && division.description}
                      <!-- Round 24: in the middle band the folded description rides under the name -->
                      <p
                        class="text-muted-foreground hidden truncate text-sm @lg/list:@max-2xl/list:block"
                        title={division.description}
                      >
                        {@render marked(division.description)}
                      </p>
                    {/if}
                    {#if responsive}
                      <!-- Round 15: the folded columns, under the name -->
                      <p
                        class="text-muted-foreground hidden items-center gap-1 truncate text-xs @max-lg/list:flex"
                      >
                        {#if columns.visible("code")}
                          <span class="font-mono">{@render marked(division.code)}</span> ·
                        {/if}
                        {inTrash ? "Deleted" : "Updated"}
                        <RecordTime iso={inTrash ? division.deletedAt : division.updatedAt} />
                      </p>
                    {/if}
                  </div>
                </div>
              </Table.Cell>
              {#if columns.visible("code")}
                <Table.Cell class={cn("font-mono text-xs", columnClass("utility"), FOLD.meta)}
                  >{@render marked(division.code)}</Table.Cell
                >
              {/if}
              {#if columns.visible("description")}
                <Table.Cell
                  class={cn("text-muted-foreground w-full max-w-0 min-w-[16ch]", FOLD.description)}
                >
                  <span class="block truncate" title={division.description ?? undefined}
                    >{#if division.description}{@render marked(
                        division.description
                      )}{:else}—{/if}</span
                  >
                </Table.Cell>
              {/if}
              {#if columns.visible("updatedAt")}
                <Table.Cell class={cn(columnClass("utility"), FOLD.updated)}
                  ><RecordTime
                    iso={inTrash ? division.deletedAt : division.updatedAt}
                  /></Table.Cell
                >
              {/if}
              <Table.Cell
                class={cn(
                  PINNED_BG,
                  "pinned-end sticky right-0 z-10 text-right",
                  columnClass("utility")
                )}
              >
                {#if view && inTrash}
                  <!-- Round 12: one action is a button, not a menu of one; ⋮ only for two or more -->
                  <Button
                    variant="ghost"
                    size="sm"
                    class={cn(ROW_ACTION, "pointer-coarse:h-11")}
                    aria-label="Restore {division.name}"
                    onclick={() => run("restore", division)}
                  >
                    <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />Restore
                  </Button>
                {:else}
                  <!-- Q3, Q16: an always-visible ⋮ with a 44px touch target; it stays lit while its menu is open -->
                  <DropdownMenu.Root
                    open={menuFor === division.id}
                    onOpenChange={(open) => (menuFor = open ? division.id : null)}
                  >
                    <DropdownMenu.Trigger>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          data-slot="button"
                          variant="ghost"
                          size="icon"
                          class={cn(
                            view && ROW_ACTION,
                            "data-[state=open]:bg-background data-[state=open]:ring-ring/50 data-[state=open]:ring-[3px] pointer-coarse:size-11"
                          )}
                          aria-label="Actions for {division.name}"
                        >
                          <EllipsisVerticalIcon aria-hidden="true" />
                        </Button>
                      {/snippet}
                    </DropdownMenu.Trigger>
                    <!-- Round 9: an icon per action, muted so the words lead; the menu box itself
                       takes no focus ring, the focused item shows it -->
                    <DropdownMenu.Content
                      align="end"
                      class="[&_[data-slot=dropdown-menu-item]:not([data-variant=destructive])_svg]:text-muted-foreground w-48 outline-none"
                      onkeydown={(e: KeyboardEvent) => menuKeydown(e, division)}
                    >
                      {#if inTrash}
                        <DropdownMenu.Item onSelect={stub(`Restore ${division.name}`)}
                          ><RotateCcwIcon aria-hidden="true" />Restore{@render key(
                            "R"
                          )}</DropdownMenu.Item
                        >
                      {:else}
                        <DropdownMenu.Group>
                          <DropdownMenu.Item onSelect={stub(`Edit ${division.name}`)}
                            ><PencilIcon aria-hidden="true" />Edit{@render key(
                              "E"
                            )}</DropdownMenu.Item
                          >
                          <DropdownMenu.Item onSelect={() => flip(division)}>
                            {#if isActive(division)}
                              <PowerOffIcon aria-hidden="true" />Deactivate{@render key("D")}
                            {:else}
                              <PowerIcon aria-hidden="true" />Activate{@render key("A")}
                            {/if}
                          </DropdownMenu.Item>
                        </DropdownMenu.Group>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          variant="destructive"
                          onSelect={stub(`Delete ${division.name}`)}
                          ><Trash2Icon aria-hidden="true" />Delete…{@render key(
                            "Backspace"
                          )}</DropdownMenu.Item
                        >
                      {/if}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </div>

  <!-- Q10: no paging controls when everything fits on the page -->
  {#if fits}
    {#if !filtered && list.total > 0}
      <p class="text-muted-foreground text-sm tabular-nums">{list.total} {noun(list.total)}</p>
    {:else if filtered && strip === "inline" && list.total > 0}
      <p role="status" class="text-muted-foreground text-sm tabular-nums">
        {list.total} of {of}
        {noun(of)}
      </p>
    {/if}
  {:else if view}
    {@render pager()}
  {:else}
    <ListFooter {base} {list} noun={inTrash ? "divisions in the Trash" : "divisions"} />
  {/if}
</Page>

<!-- Q2: stands in for #302's record modal -->
<Dialog.Root open={opened !== null} onOpenChange={(open) => !open && (opened = null)}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{opened?.name}</Dialog.Title>
      <Dialog.Description>
        Prototype: #302's record modal opens here, from a click anywhere on the row.
      </Dialog.Description>
    </Dialog.Header>
  </Dialog.Content>
</Dialog.Root>
