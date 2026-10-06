import { z } from "zod";
import { indonesianPhoneSchema, optionalText } from "./inputs.js";
import { PASSWORD_CONTEXT_MESSAGE, passwordContainsContext, passwordSchema } from "./password.js";
import {
  PageSchema,
  PerPageSchema,
  SearchSchema,
  SortDirectionSchema,
  TrashedSchema,
  listResponse
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
  // The roles this user holds after the save: the whole set, not a change.
  roleIds: z.array(z.uuid()).default([]),
  status: UserStatusSchema.default("active"),
  profilePhotoPath: optionalText(255)
};

/**
 * Both forms validate the same fields; only the password rule differs. An
 * empty password means "leave the credential alone" on the edit form and is
 * rejected on create, so the two schemas share everything else.
 */
const UserFormSchema = z
  .object({
    ...userFields,
    password: z.union([z.literal(""), passwordSchema]).default(""),
    passwordConfirmation: z.string().default("")
  })
  .refine((data) => data.password === "" || !passwordContainsContext(data.password, data.email), {
    message: PASSWORD_CONTEXT_MESSAGE,
    path: ["password"]
  });

export const UserCreateInputSchema = UserFormSchema.refine((data) => data.password !== "", {
  message: "Password is required.",
  path: ["password"]
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords do not match.",
  path: ["passwordConfirmation"]
});

export type UserCreateInput = z.infer<typeof UserCreateInputSchema>;

export const UserUpdateInputSchema = UserFormSchema.refine(
  (data) => data.password === "" || data.password === data.passwordConfirmation,
  { message: "Passwords do not match.", path: ["passwordConfirmation"] }
);

export type UserUpdateInput = z.infer<typeof UserUpdateInputSchema>;

export const UserSortSchema = z.enum(["name", "email", "createdAt", "updatedAt"]).default("name");

export const UserListQuerySchema = z.object({
  search: SearchSchema,
  status: z.enum(["all", ...USER_STATUSES]).default("all"),
  divisionId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(z.uuid().optional()),
  trashed: TrashedSchema,
  sort: UserSortSchema,
  dir: SortDirectionSchema,
  page: PageSchema,
  perPage: PerPageSchema
});

export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const UserListResponseSchema = listResponse(UserSchema);

export type UserListResponse = z.infer<typeof UserListResponseSchema>;
