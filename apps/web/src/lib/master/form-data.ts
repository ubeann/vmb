import type { Division, DivisionInput, Role, RoleInput, User, UserUpdateInput } from "@vmb/types";

/** A Role's form: the shared input, and on an edit the `updatedAt` it loaded. */
export type RoleFormFields = RoleInput & { updatedAt?: string | null };

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
 * the exact string the API served.
 */
export function divisionFormData(division: Division) {
  return {
    name: division.name,
    code: division.code,
    description: division.description ?? "",
    colorHex: division.colorHex,
    iconName: division.iconName,
    isActive: division.isActive,
    updatedAt: division.updatedAt
  };
}

export function roleFormData(role: Role) {
  return {
    name: role.name,
    description: role.description ?? "",
    colorHex: role.colorHex,
    iconName: role.iconName,
    isActive: role.isActive,
    updatedAt: role.updatedAt
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
