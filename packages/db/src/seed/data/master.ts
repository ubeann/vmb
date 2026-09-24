import { ID_GROUPS, atMinute, fixtureId, softStamps, stamps } from "../ids.js";
import { table } from "../sql.js";

/**
 * The preview login (issue #120): one shared credential user so the tech team
 * can sign in to a preview and click through the UI without signing up or
 * receiving email.
 *
 * The password is committed on purpose — it only ever exists on an ephemeral,
 * synthetic preview branch — and the digest was produced by Better Auth's own
 * hasher (`better-auth/crypto`'s `hashPassword`), so the same verifier
 * `apps/api`'s sign-in route uses accepts it. `apps/api`'s preview-login test
 * asserts that compatibility rather than trusting this comment.
 *
 * The UUID is shared with the `master.users` row below because the ten
 * business FKs (requesters, approvers, drivers of plans and actuals) point at
 * `master.users`, while Better Auth reads only `public."user"`. The seeder
 * maintains both rows with the same id so a preview click-through resolves at
 * either end; imported databases get the same alignment from the identity
 * transform (#7, ADR-0032).
 */
export const PREVIEW_USER_ID = fixtureId(ID_GROUPS.user, 1);
export const PREVIEW_USER_EMAIL = "preview@vmblogistics.id";
export const PREVIEW_USER_PASSWORD = "preview-password";
export const PREVIEW_USER_PASSWORD_HASH =
  "94ab73dbe9a7d76c1908a13d7786bfda:76850c6b81ff1c69849d3ea338f14367d72cec57776e305eb80bd48f518924744d3123627ee5427ab0e2a4e76510ec8e5e9739dfcee74ec0ae22cd79d7eb6322";

/**
 * The activation fixture (#7, ADR-0033): the shape every migrated account
 * has — a Better Auth identity with no credential row. A preview click-through
 * of `/activate` uses it end to end: the OTP is logged rather than sent
 * (issue #121), and setting a password creates the missing credential.
 */
export const ACTIVATION_USER_ID = fixtureId(ID_GROUPS.user, 2);
export const ACTIVATION_USER_EMAIL = "rina.wijaya@vmblogistics.id";

/**
 * `public` is Better Auth's schema (ADR-0012), so these rows are the
 * sign-in side of the shared identity: `user` carries the verified email and
 * `account` the credential provider with the digest above. `account_id` must
 * equal `user.id` for Better Auth's credential lookup to find the account.
 */
export const user = table(
  "public.user",
  ["id", "name", "email", "email_verified", "image", "created_at", "updated_at"],
  [
    {
      id: PREVIEW_USER_ID,
      name: "Preview User",
      email: PREVIEW_USER_EMAIL,
      email_verified: true,
      image: null,
      ...stamps(1)
    },
    {
      id: ACTIVATION_USER_ID,
      name: "Rina Wijaya",
      email: ACTIVATION_USER_EMAIL,
      email_verified: true,
      image: null,
      ...stamps(2)
    }
  ]
);

export const account = table(
  "public.account",
  [
    "id",
    "account_id",
    "provider_id",
    "user_id",
    "access_token",
    "refresh_token",
    "id_token",
    "access_token_expires_at",
    "refresh_token_expires_at",
    "scope",
    "password",
    "created_at",
    "updated_at"
  ],
  [
    {
      id: fixtureId(ID_GROUPS.account, 1),
      account_id: PREVIEW_USER_ID,
      provider_id: "credential",
      user_id: PREVIEW_USER_ID,
      access_token: null,
      refresh_token: null,
      id_token: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      scope: null,
      password: PREVIEW_USER_PASSWORD_HASH,
      ...stamps(1)
    }
  ]
);

const divisions = table(
  "master.divisions",
  [
    "id",
    "name",
    "code",
    "description",
    "color_hex",
    "icon_name",
    "is_active",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  [
    {
      id: fixtureId(ID_GROUPS.division, 1),
      name: "Operations",
      code: "OPS",
      description: "Fleet, trips and day-to-day operations",
      color_hex: "#2563EB",
      icon_name: "heroicon-o-cog-6-tooth",
      is_active: true,
      ...softStamps(1)
    },
    {
      id: fixtureId(ID_GROUPS.division, 2),
      name: "Finance",
      code: "FIN",
      description: "Budgets, invoices and payment settlement",
      color_hex: "#16A34A",
      icon_name: "heroicon-o-banknotes",
      is_active: true,
      ...softStamps(2)
    },
    {
      id: fixtureId(ID_GROUPS.division, 3),
      name: "Human Resources",
      code: "HRD",
      description: "People, payroll and administration",
      color_hex: "#DB2777",
      icon_name: "heroicon-o-user-group",
      is_active: true,
      ...softStamps(3)
    },
    {
      id: fixtureId(ID_GROUPS.division, 4),
      name: "Information Technology",
      code: "ITD",
      description: "Systems, devices and internal support",
      color_hex: "#7C3AED",
      icon_name: "heroicon-o-computer-desktop",
      is_active: true,
      ...softStamps(4)
    },
    {
      id: fixtureId(ID_GROUPS.division, 5),
      name: "Warehouse",
      code: "WHS",
      description: "Stock, procurement and requisitions",
      color_hex: "#EA580C",
      icon_name: "heroicon-o-cube",
      is_active: true,
      ...softStamps(5)
    },
    {
      id: fixtureId(ID_GROUPS.division, 6),
      name: "Trucking",
      code: "TRK",
      description: "Container haulage and route execution",
      color_hex: "#0891B2",
      icon_name: "heroicon-o-truck",
      is_active: true,
      ...softStamps(6)
    },
    {
      id: fixtureId(ID_GROUPS.division, 7),
      name: "Procurement",
      code: "PRC",
      description: "Vendor selection and purchasing",
      color_hex: "#CA8A04",
      icon_name: "heroicon-o-shopping-cart",
      is_active: true,
      ...softStamps(7)
    },
    {
      id: fixtureId(ID_GROUPS.division, 8),
      name: "Legal",
      code: "LGL",
      description: "Contracts, permits and compliance",
      color_hex: "#4B5563",
      icon_name: "heroicon-o-scale",
      is_active: true,
      ...softStamps(8)
    },
    {
      id: fixtureId(ID_GROUPS.division, 9),
      name: "Health, Safety & Environment",
      code: "HSE",
      description: "Workplace safety and environmental controls",
      color_hex: "#DC2626",
      icon_name: "heroicon-o-shield-check",
      is_active: true,
      ...softStamps(9)
    },
    {
      id: fixtureId(ID_GROUPS.division, 10),
      name: "Quality Assurance",
      code: "QAS",
      description: "Service quality and audit follow-up",
      color_hex: "#0D9488",
      icon_name: "heroicon-o-clipboard-document-check",
      is_active: true,
      ...softStamps(10)
    },
    {
      id: fixtureId(ID_GROUPS.division, 11),
      name: "Marketing",
      code: "MKT",
      description: "Client relations and market development",
      color_hex: "#9333EA",
      icon_name: "heroicon-o-megaphone",
      is_active: true,
      ...softStamps(11)
    },
    {
      id: fixtureId(ID_GROUPS.division, 12),
      name: "General Affairs",
      code: "GAD",
      description: "Facilities, vehicles and office support",
      color_hex: "#64748B",
      icon_name: "heroicon-o-building-office",
      is_active: true,
      ...softStamps(12)
    }
  ]
);

const people = [
  { name: "Preview User", email: PREVIEW_USER_EMAIL },
  { name: "Rina Wijaya", email: "rina.wijaya@vmblogistics.id" },
  { name: "Agus Setiawan", email: "agus.setiawan@vmblogistics.id" },
  { name: "Siti Lestari", email: "siti.lestari@vmblogistics.id" },
  { name: "Budi Hartono", email: "budi.hartono@vmblogistics.id" },
  { name: "Dewi Anggraini", email: "dewi.anggraini@vmblogistics.id" },
  { name: "Eko Nugroho", email: "eko.nugroho@vmblogistics.id" },
  { name: "Fitri Handayani", email: "fitri.handayani@vmblogistics.id" },
  { name: "Gunawan Saputra", email: "gunawan.saputra@vmblogistics.id" },
  { name: "Hesti Purwanti", email: "hesti.purwanti@vmblogistics.id" },
  { name: "Irfan Maulana", email: "irfan.maulana@vmblogistics.id" },
  { name: "Joko Susilo", email: "joko.susilo@vmblogistics.id" }
];

/**
 * The legacy business user table. `password` is NOT NULL but Better Auth never
 * reads it — identity is owned by Better Auth (ADR-0012) — so every row,
 * preview user included, carries a marker rather than a second copy of the
 * credential. The credential lives only in `public.account` above.
 * `division_id` pairs each user with the division of the same index, which is
 * what makes every division in the list clickable.
 */
const roles = table(
  "master.roles",
  [
    "id",
    "name",
    "guard_name",
    "level",
    "is_active",
    "is_system",
    "color_hex",
    "icon_name",
    "description",
    "metadata",
    "created_at",
    "updated_at"
  ],
  [
    {
      id: fixtureId(ID_GROUPS.role, 1),
      name: "Super Admin",
      guard_name: "web",
      level: 3,
      is_active: true,
      is_system: true,
      color_hex: "#3182CE",
      icon_name: "heroicon-o-shield-check",
      description: "Full access to all system features, configurations, and settings.",
      metadata: null,
      ...stamps(1)
    },
    {
      id: fixtureId(ID_GROUPS.role, 2),
      name: "Manager Finance",
      guard_name: "web",
      level: 2,
      is_active: true,
      is_system: false,
      color_hex: "#48BB78",
      icon_name: "heroicon-o-banknotes",
      description: "Responsible for financial planning, budget management, and fiscal oversight.",
      metadata: null,
      ...stamps(2)
    },
    {
      id: fixtureId(ID_GROUPS.role, 3),
      name: "Manager Division",
      guard_name: "web",
      level: 2,
      is_active: true,
      is_system: false,
      color_hex: "#ED8936",
      icon_name: "heroicon-o-building-office-2",
      description:
        "Ensures operational efficiency, oversees workflows, and manages division activities.",
      metadata: null,
      ...stamps(3)
    },
    {
      id: fixtureId(ID_GROUPS.role, 4),
      name: "Staff",
      guard_name: "web",
      level: 0,
      is_active: true,
      is_system: false,
      color_hex: "#805AD5",
      icon_name: "heroicon-o-user",
      description: "Supports daily operations, office management, and administrative functions.",
      metadata: null,
      ...stamps(4)
    }
  ]
);

const users = table(
  "master.users",
  [
    "id",
    "name",
    "status",
    "division_id",
    "phone",
    "email",
    "email_verified_at",
    "profile_photo_path",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  people.map((person, position) => {
    const index = position + 1;
    return {
      id: fixtureId(ID_GROUPS.user, index),
      name: person.name,
      status: "active",
      division_id: fixtureId(ID_GROUPS.division, index),
      phone: `+62 811-1000-${String(index).padStart(4, "0")}`,
      email: person.email,
      // one minute after the row's own created_at, never before it
      email_verified_at: atMinute(index * 10 + 1),
      profile_photo_path: null,
      ...softStamps(index)
    };
  })
);

export const masterTables = [divisions, roles, users];
