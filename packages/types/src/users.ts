import { z } from "zod";
import { indonesianPhoneSchema, optionalText, updatedAtSchema } from "./inputs.js";
import { PASSWORD_CONTEXT_MESSAGE, passwordContainsContext, passwordSchema } from "./password.js";
import {
  DateFilterSchema,
  PageSchema,
  PerPageSchema,
  SearchSchema,
  SortDirectionSchema,
  TimeZoneSchema,
  TrashedSchema,
  ViewCountsSchema,
  listResponse,
  optionCounts,
  splitListParam,
  valueFilter
} from "./list.js";

export const USER_STATUSES = ["active", "inactive", "suspended"] as const;

export const UserStatusSchema = z.enum(USER_STATUSES);

export type UserStatus = z.infer<typeof UserStatusSchema>;

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended"
};

export const UserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: UserStatusSchema,
  roles: z.array(z.object({ id: z.uuid(), name: z.string() })),
  // the divisions those roles are scoped to, once each (a user has no division of their own)
  divisions: z.array(z.object({ id: z.uuid(), name: z.string() })),
  phone: z.string().nullable(),
  email: z.string(),
  emailVerified: z.boolean(),
  profilePhotoPath: z.string().nullable(),
  createdAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable()
});

export type User = z.infer<typeof UserSchema>;

const userFields = {
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(255, "Name must be 255 characters or fewer."),
  email: z.email("Enter a valid email address.").max(255, "Email must be 255 characters or fewer."),
  phone: indonesianPhoneSchema,
  status: UserStatusSchema.default("active"),
  profilePhotoPath: optionalText(255)
};

/**
 * Both forms validate the same fields; only the password rule differs. An
 * empty password means "leave the credential alone" on the edit form and is
 * rejected on create, so the two schemas share everything else.
 */
const passwordFields = {
  password: z.union([z.literal(""), passwordSchema]).default(""),
  passwordConfirmation: z.string().default("")
};

function refusePasswordContext<T extends z.ZodType<{ password: string; email: string }>>(
  schema: T
) {
  return schema.refine(
    (data) => data.password === "" || !passwordContainsContext(data.password, data.email),
    { message: PASSWORD_CONTEXT_MESSAGE, path: ["password"] }
  );
}

// A new user starts with the roles chosen, none by default.
export const UserCreateInputSchema = refusePasswordContext(
  z.object({ ...userFields, roleIds: z.array(z.uuid()).default([]), ...passwordFields })
)
  .refine((data) => data.password !== "", {
    message: "Password is required.",
    path: ["password"]
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"]
  });

export type UserCreateInput = z.infer<typeof UserCreateInputSchema>;

// Omitting `roleIds` leaves the user's roles alone; a list is their whole new set.
// `updatedAt` is the stamp the editor loaded, so a save over a newer edit is refused.
export const UserUpdateInputSchema = refusePasswordContext(
  z.object({
    ...userFields,
    roleIds: z.array(z.uuid()).optional(),
    ...passwordFields,
    updatedAt: updatedAtSchema
  })
).refine((data) => data.password === "" || data.password === data.passwordConfirmation, {
  message: "Passwords do not match.",
  path: ["passwordConfirmation"]
});

export type UserUpdateInput = z.infer<typeof UserUpdateInputSchema>;

export const UserSortSchema = z.enum(["name", "email", "createdAt", "updatedAt"]).default("name");

/**
 * The Division and Role filters' parameter: the ids chosen, each once, in the
 * order the URL gave them (`division=a,b`, ADR-0051 rule 4). An id that is
 * not a uuid fails at its own index, so `parseListQuery` can drop that value
 * and keep the others.
 */
export const IdListFilterSchema = z
  .string()
  .transform(splitListParam)
  .pipe(z.array(z.uuid()))
  .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))])
  .default([]);

/**
 * The Users list's state, as its URL carries it (#304, ADR-0051 rule 4):
 * `status`, `division` and `role` take several values (`status=active,suspended`),
 * and `updated` and `created` a preset (`today`, `week`, `month`) or an
 * inclusive `YYYY-MM-DD..YYYY-MM-DD` range. A user is in a division when they
 * hold a role scoped to it, and has a role when they hold it.
 */
export const UserListQuerySchema = z.object({
  search: SearchSchema,
  status: valueFilter(USER_STATUSES),
  division: IdListFilterSchema,
  role: IdListFilterSchema,
  updated: DateFilterSchema,
  created: DateFilterSchema,
  trashed: TrashedSchema,
  sort: UserSortSchema,
  dir: SortDirectionSchema,
  page: PageSchema,
  perPage: PerPageSchema
});

export type UserListQuery = z.infer<typeof UserListQuerySchema>;

/**
 * What `GET /api/master/users` takes: the list's state plus the reader's time
 * zone, which decides where each day of a date filter starts and ends (as for
 * Divisions).
 */
export const UserListRequestSchema = UserListQuerySchema.extend({ tz: TimeZoneSchema });

export type UserListRequest = z.infer<typeof UserListRequestSchema>;

/**
 * A page of users, with the counts the list kit shows beside its controls:
 * each view's rows (the All and Trash tabs), and each Status, Division and Role
 * option's rows in the current view. Every count keeps the search and the
 * other filters; a Division or Role with no user in it has no entry.
 */
export const UserListResponseSchema = listResponse(UserSchema).extend({
  views: ViewCountsSchema,
  facets: z.object({
    status: optionCounts(USER_STATUSES),
    division: z.record(z.uuid(), z.number().int().min(0)),
    role: z.record(z.uuid(), z.number().int().min(0))
  })
});

export type UserListResponse = z.infer<typeof UserListResponseSchema>;
