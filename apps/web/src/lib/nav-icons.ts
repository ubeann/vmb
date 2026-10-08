import type { NavIcon } from "$lib/nav.js";
import Building2 from "@lucide/svelte/icons/building-2";
import KeyRound from "@lucide/svelte/icons/key-round";
import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
import Users from "@lucide/svelte/icons/users";

// The component behind each `nav.ts` icon name, shared by the sidebar and the trail so a
// screen shows one icon wherever it appears.
export const NAV_ICONS: Record<NavIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  divisions: Building2,
  roles: KeyRound,
  users: Users
};
