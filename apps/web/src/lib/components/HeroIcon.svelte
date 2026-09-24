<script lang="ts">
  import BanknoteIcon from "@lucide/svelte/icons/banknote";
  import BoxIcon from "@lucide/svelte/icons/box";
  import Building2Icon from "@lucide/svelte/icons/building-2";
  import BuildingIcon from "@lucide/svelte/icons/building";
  import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
  import CogIcon from "@lucide/svelte/icons/cog";
  import HouseIcon from "@lucide/svelte/icons/house";
  import MegaphoneIcon from "@lucide/svelte/icons/megaphone";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import RocketIcon from "@lucide/svelte/icons/rocket";
  import ScaleIcon from "@lucide/svelte/icons/scale";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import ShapesIcon from "@lucide/svelte/icons/shapes";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";
  import TruckIcon from "@lucide/svelte/icons/truck";
  import UserIcon from "@lucide/svelte/icons/user";
  import UsersIcon from "@lucide/svelte/icons/users";
  import { heroiconToLucide, type LucideIconKey } from "./hero-icons.js";

  // Decorative by default; pass `label` when the icon is the only carrier of meaning.
  let {
    name,
    label,
    class: className
  }: { name: string; label?: string; class?: string } = $props();

  const ICONS: Record<LucideIconKey, typeof ShapesIcon> = {
    banknote: BanknoteIcon,
    box: BoxIcon,
    building: BuildingIcon,
    "building-2": Building2Icon,
    "clipboard-check": ClipboardCheckIcon,
    cog: CogIcon,
    house: HouseIcon,
    megaphone: MegaphoneIcon,
    monitor: MonitorIcon,
    rocket: RocketIcon,
    scale: ScaleIcon,
    settings: SettingsIcon,
    shapes: ShapesIcon,
    "shield-check": ShieldCheckIcon,
    "shopping-cart": ShoppingCartIcon,
    truck: TruckIcon,
    user: UserIcon,
    users: UsersIcon
  };

  const key = $derived(heroiconToLucide(name));
  const Icon = $derived(ICONS[key]);
</script>

<Icon
  class={className}
  data-icon={key}
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
/>
