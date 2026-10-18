import {
  PermissionKeysSchema,
  RoleInputSchema,
  RoleUpdateInputSchema,
  type Division,
  type DivisionInput,
  type IconName,
  type RoleDetail,
  type RoleUpdateInput,
  type User,
  type UserUpdateInput
} from "@vmb/types";

/**
 * The Role form's schemas: the shared input, except that the form always sends
 * its grants. A form post with no box ticked carries no `permissionKeys` at
 * all, which the API reads as "leave the grants alone"; here it is the empty
 * set, so unticking every box revokes every grant.
 */
const formGrants = { permissionKeys: PermissionKeysSchema.default([]) };
export const RoleFormSchema = RoleInputSchema.extend(formGrants);
export const RoleFormUpdateSchema = RoleUpdateInputSchema.extend(formGrants);

/** A Role's form: its fields and grants, and on an edit the `updatedAt` it loaded. */
export type RoleFormFields = Omit<RoleUpdateInput, "updatedAt"> & { updatedAt?: string | null };

/**
 * A User's form: an edit's fields and its `updatedAt`. A new user's form has
 * no `updatedAt`, and asks for the password that an edit leaves alone.
 */
export type UserFormFields = Omit<UserUpdateInput, "updatedAt"> & { updatedAt?: string | null };

/** A Division's form: the shared input, and on an edit the `updatedAt` it loaded. */
export type DivisionFormFields = DivisionInput & { updatedAt?: string | null };

/**
 * A stored record always has its text columns; the forms work in the empty
 * string. These map a record into the shape the shared input schema parses,
 * so an edit form loads the values the admin edits, not the storage shape.
 * `updatedAt` rides along as the stamp the save is checked against, so it is
 * the exact string the API served. A stored icon outside the catalogue (#176)
 * loads as it is, so the form shows it and asks for another.
 */
export function divisionFormData(division: Division) {
  return {
    name: division.name,
    code: division.code,
    description: division.description ?? "",
    colorHex: division.colorHex,
    iconName: division.iconName as IconName,
    isActive: division.isActive,
    updatedAt: division.updatedAt
  };
}

export function roleFormData(role: RoleDetail) {
  return {
    name: role.name,
    description: role.description ?? "",
    colorHex: role.colorHex,
    iconName: role.iconName as IconName,
    isActive: role.isActive,
    permissionKeys: role.permissionKeys,
    updatedAt: role.updatedAt
  };
}

/** The profile form: a person's own name, phone and photo link. */
export function profileFormData(user: User) {
  return {
    name: user.name,
    phone: user.phone ?? "",
    profilePhotoPath: user.profilePhotoPath ?? ""
  };
}

export function userFormData(user: User) {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    roleIds: user.roles.map((role) => role.id),
    status: user.status,
    profilePhotoPath: user.profilePhotoPath ?? "",
    password: "",
    passwordConfirmation: "",
    updatedAt: user.updatedAt
  };
}
