// The icons a record can be given (#302, #176): a curated set of Lucide's in
// the groups the picker browses, each with the words a search or a record's
// name finds it by. Lucide has some 1,800; a department needs a few dozen
// that fit it, and each one offered is one more in the bundle.

// the type alone: the catalogue reads on a server or in a unit test without drawing anything
import type { GLYPHS } from "./glyphs.js";

export type IconName = keyof typeof GLYPHS;

export type CatalogIcon = {
  name: IconName;
  /** What a person picking it calls it. */
  label: string;
  /** Words it is found by, beyond its name and label. */
  keywords: string[];
  /** Its group's label. */
  category: string;
};

export type IconCategory = { id: string; label: string; icons: CatalogIcon[] };

// [Lucide name, label, keywords]
const DATA: { id: string; label: string; icons: [IconName, string, string][] }[] = [
  {
    id: "people",
    label: "People",
    icons: [
      ["users", "People", "team staff group employees members personnel human resources hr"],
      ["users-round", "Team", "team group staff crew"],
      ["user", "Person", "person staff employee member individual"],
      ["user-round", "Member", "person member profile"],
      ["user-plus", "Recruiting", "recruit hiring hire onboarding new staff human resources hr"],
      ["user-check", "Approved person", "approval verified attendance"],
      ["user-cog", "Admin", "administrator admin management settings"],
      ["contact", "Contact", "contact directory card address"],
      ["id-card", "ID card", "identity badge employee human resources hr"],
      ["badge-check", "Verified", "verified certified quality approved"],
      ["handshake", "Handshake", "partner partnership deal agreement relations customer"],
      ["heart-handshake", "Care", "care welfare support wellbeing community"],
      ["smile", "Smile", "happy customer satisfaction service"],
      ["graduation-cap", "Training", "training education learning academy courses"],
      ["school", "School", "school education campus"],
      ["person-standing", "Standing person", "person people health"],
      ["accessibility", "Accessibility", "accessibility inclusion"]
    ]
  },
  {
    id: "money",
    label: "Money",
    icons: [
      ["banknote", "Banknotes", "money cash finance payment payroll"],
      ["wallet", "Wallet", "money finance budget spending payment"],
      ["coins", "Coins", "money finance cash change"],
      ["credit-card", "Card", "payment card billing finance"],
      ["piggy-bank", "Savings", "savings budget finance money"],
      ["landmark", "Bank", "bank finance treasury government institution"],
      ["receipt", "Receipt", "invoice bill expense accounting purchase"],
      ["calculator", "Calculator", "accounting finance tax calculation budget"],
      ["chart-line", "Line chart", "report analytics growth trend finance"],
      ["chart-pie", "Pie chart", "report analytics share budget"],
      ["chart-column", "Bar chart", "report analytics statistics"],
      ["trending-up", "Trending up", "growth sales performance increase"],
      ["percent", "Percent", "tax discount rate interest"],
      ["hand-coins", "Payment", "payment payroll salary finance money"],
      ["circle-dollar-sign", "Dollar", "money finance currency revenue"],
      ["scale", "Scale", "legal law justice balance compliance"],
      ["gem", "Gem", "value premium asset"]
    ]
  },
  {
    id: "logistics",
    label: "Logistics",
    icons: [
      ["truck", "Truck", "delivery shipping transport trucking haulage fleet logistics"],
      ["package", "Package", "parcel shipment goods item product stock"],
      ["package-check", "Delivered", "delivered received goods receipt inbound"],
      ["package-open", "Unpacked", "unpack receiving inbound goods"],
      ["boxes", "Stock", "stock inventory goods warehouse storage"],
      ["box", "Box", "box product item stock package"],
      ["warehouse", "Warehouse", "warehouse storage depot stock inventory logistics"],
      ["container", "Container", "container shipping freight cargo port"],
      ["forklift", "Forklift", "forklift warehouse handling loading"],
      ["ship", "Ship", "ship shipping freight cargo sea port"],
      ["plane", "Plane", "air freight flight travel"],
      ["train-front", "Train", "rail train freight transport"],
      ["car", "Car", "vehicle car fleet transport"],
      ["bus", "Bus", "bus transport shuttle"],
      ["route", "Route", "route path delivery planning dispatch"],
      ["map", "Map", "map area region territory"],
      ["map-pin", "Location", "location site place branch address"],
      ["navigation", "Navigation", "navigation direction dispatch"],
      ["compass", "Compass", "direction exploration planning"],
      ["fuel", "Fuel", "fuel gas petrol fleet"],
      ["anchor", "Anchor", "port harbour marine"],
      ["scan-barcode", "Scanner", "scan barcode inventory receiving"],
      ["barcode", "Barcode", "barcode product sku inventory"],
      ["qr-code", "QR code", "qr code scan"],
      ["clipboard-list", "Checklist", "checklist list picking orders tasks"],
      ["archive", "Archive", "archive records storage"]
    ]
  },
  {
    id: "office",
    label: "Office",
    icons: [
      ["building", "Office", "office building company headquarters"],
      ["building-2", "Office block", "office building corporate company"],
      ["briefcase", "Briefcase", "business work job management"],
      ["briefcase-business", "Business", "business management executive"],
      ["clipboard", "Clipboard", "clipboard notes administration"],
      ["clipboard-check", "Inspection", "inspection audit quality checklist compliance"],
      ["file-text", "Document", "document file report paperwork"],
      ["files", "Files", "files documents records"],
      ["folder", "Folder", "folder files records"],
      ["folder-open", "Open folder", "folder files projects"],
      ["printer", "Printer", "print printing office"],
      ["paperclip", "Paperclip", "attachment office supplies"],
      ["stamp", "Stamp", "stamp approval official legal"],
      ["calendar", "Calendar", "calendar schedule planning events"],
      ["calendar-check", "Scheduled", "schedule appointment booking"],
      ["clock", "Clock", "time shift attendance hours"],
      ["inbox", "Inbox", "inbox requests mail incoming"],
      ["mail", "Mail", "mail email correspondence"],
      ["library", "Library", "library archive knowledge"],
      ["notebook", "Notebook", "notes records minutes"],
      ["pen-line", "Pen", "writing editing contracts"],
      ["signature", "Signature", "signature contract legal approval"],
      ["house", "Home", "home house general main"]
    ]
  },
  {
    id: "tech",
    label: "Tech",
    icons: [
      ["monitor", "Computer", "computer monitor desktop it information technology"],
      ["laptop", "Laptop", "laptop computer it information technology"],
      ["server", "Server", "server infrastructure it hosting"],
      ["database", "Database", "database data storage records"],
      ["cpu", "Chip", "hardware chip processor engineering"],
      ["hard-drive", "Drive", "storage backup drive"],
      ["wifi", "Wi-Fi", "network wireless internet"],
      ["network", "Network", "network infrastructure it"],
      ["cloud", "Cloud", "cloud hosting online"],
      ["code", "Code", "code development software engineering programming"],
      ["terminal", "Terminal", "terminal console engineering devops"],
      ["smartphone", "Phone app", "mobile smartphone app"],
      ["router", "Router", "router network infrastructure"],
      ["bug", "Bug", "bug testing quality engineering"],
      ["lock", "Lock", "security lock access"],
      ["key-round", "Key", "key access security"],
      ["shield-check", "Shield", "security protection safety compliance"]
    ]
  },
  {
    id: "operations",
    label: "Operations",
    icons: [
      ["settings", "Settings", "settings operations configuration maintenance"],
      ["cog", "Cog", "operations engineering mechanics"],
      ["wrench", "Wrench", "maintenance repair tools workshop"],
      ["hammer", "Hammer", "tools construction carpentry"],
      ["drill", "Drill", "tools workshop maintenance"],
      ["construction", "Construction", "construction works project site"],
      ["hard-hat", "Hard hat", "safety construction site worker"],
      ["factory", "Factory", "factory production manufacturing plant"],
      ["plug", "Plug", "electric power utilities"],
      ["zap", "Power", "electric power energy"],
      ["flame", "Flame", "fire heat energy"],
      ["droplet", "Water", "water utilities liquid"],
      ["thermometer", "Temperature", "temperature cold chain climate"],
      ["gauge", "Gauge", "performance metrics speed"],
      ["recycle", "Recycle", "recycling waste environment"],
      ["leaf", "Leaf", "environment green sustainability agriculture"],
      ["shield", "Safety", "safety protection security"],
      ["siren", "Siren", "emergency alert security"],
      ["fire-extinguisher", "Extinguisher", "fire safety emergency"],
      ["life-buoy", "Lifebuoy", "support help rescue service"],
      ["briefcase-medical", "First aid", "medical first aid health safety"],
      ["hospital", "Hospital", "health medical clinic"],
      ["stethoscope", "Stethoscope", "health medical doctor clinic"],
      ["heart-pulse", "Health", "health wellness medical"],
      ["microscope", "Microscope", "laboratory research science quality"],
      ["flask-conical", "Lab", "laboratory chemistry research testing"],
      ["utensils", "Canteen", "canteen kitchen food catering"],
      ["coffee", "Coffee", "pantry break cafe"],
      ["scissors", "Scissors", "cutting crafts tailoring"]
    ]
  },
  {
    id: "sales",
    label: "Sales",
    icons: [
      ["megaphone", "Megaphone", "marketing announcement campaign promotion"],
      ["message-circle", "Message", "message chat support"],
      ["messages-square", "Messages", "messages chat communication"],
      ["phone", "Phone", "phone call contact support"],
      ["headset", "Headset", "customer service support helpdesk call center communication"],
      ["bell", "Bell", "notifications alerts"],
      ["send", "Send", "send dispatch outreach"],
      ["globe", "Globe", "global international export web"],
      ["newspaper", "News", "news media press communications"],
      ["presentation", "Presentation", "presentation meeting training"],
      ["shopping-cart", "Cart", "purchasing procurement buying orders"],
      ["shopping-bag", "Bag", "retail shopping sales"],
      ["store", "Store", "store shop retail outlet branch"],
      ["tag", "Tag", "price label pricing"],
      ["tags", "Tags", "pricing labels catalogue"],
      ["gift", "Gift", "gift rewards benefits"],
      ["star", "Star", "favourite rating quality"],
      ["trophy", "Trophy", "award achievement competition"],
      ["award", "Award", "award recognition quality"],
      ["target", "Target", "goals targets strategy"],
      ["rocket", "Rocket", "launch growth startup projects"],
      ["lightbulb", "Idea", "ideas innovation research"],
      ["flag", "Flag", "milestone goal country"],
      ["heart", "Heart", "care favourite community"],
      ["crown", "Crown", "leadership executive premium"],
      ["sparkles", "Sparkles", "new special highlight"],
      ["palette", "Palette", "design creative art branding"],
      ["camera", "Camera", "photography media"],
      ["video", "Video", "video media production"],
      ["book-open", "Book", "knowledge manuals reading"]
    ]
  }
];

export const CATEGORIES: IconCategory[] = DATA.map(({ id, label, icons }) => ({
  id,
  label,
  icons: icons.map(([name, iconLabel, keywords]) => ({
    name,
    label: iconLabel,
    keywords: keywords.split(" "),
    category: label
  }))
}));

export const CATALOG: CatalogIcon[] = CATEGORIES.flatMap((category) => category.icons);

const BY_NAME = new Map<string, CatalogIcon>(CATALOG.map((icon) => [icon.name, icon]));

export function catalogIcon(name: string): CatalogIcon | undefined {
  return BY_NAME.get(name);
}

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

// every word an icon answers to: its name's parts, its label's, its keywords and its group's
const SEARCHED = new Map(
  CATALOG.map((icon) => [
    icon,
    [
      ...new Set([
        ...wordsOf(icon.name),
        ...wordsOf(icon.label),
        ...icon.keywords,
        ...wordsOf(icon.category)
      ])
    ]
  ])
);

/** The icons every word of the query begins a word of: "mon" finds Computer and the money ones. */
export function searchIcons(query: string): CatalogIcon[] {
  const terms = wordsOf(query);
  if (terms.length === 0) return [];
  return CATALOG.filter((icon) =>
    terms.every((term) => SEARCHED.get(icon)!.some((word) => word.startsWith(term)))
  );
}

// words in a department's name that say nothing about what it does
const GENERIC = new Set(["and", "the", "for", "division", "department", "dept", "unit", "general"]);

/**
 * Icons for a record's name, as Code is suggested from it: "Finance" gives
 * Banknotes, Wallet and the other money icons. A word matches a keyword that
 * begins it or that it begins, so "Trucking" finds Truck and "ship" Shipping.
 */
export function suggestIcons(name: string, limit = 8): CatalogIcon[] {
  const words = wordsOf(name).filter((word) => word.length >= 3 && !GENERIC.has(word));
  if (words.length === 0) return [];
  return CATALOG.filter((icon) =>
    [...icon.keywords, ...wordsOf(icon.name)].some(
      (keyword) =>
        keyword.length >= 3 &&
        words.some((word) => keyword.startsWith(word) || word.startsWith(keyword))
    )
  ).slice(0, limit);
}
