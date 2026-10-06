import type { Division, Role, User } from "@vmb/types";

/**
 * A stored record always has its text columns; the forms work in the empty
 * string. These map a record into the shape the shared input schema parses,
 * so an edit form loads the values the admin edits, not the storage shape.
 */
export function divisionFormData(division: Division) {
  return {
    name: division.name,
    code: division.code,
    description: division.description ?? "",
    colorHex: division.colorHex,
    iconName: division.iconName,
    isActive: division.isActive
  };
}

export function roleFormData(role: Role) {
  return {
    name: role.name,
    description: role.description ?? "",
    colorHex: role.colorHex,
    iconName: role.iconName,
    isActive: role.isActive
  };
}

export function userFormData(user: User) {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    divisionId: user.divisionId ?? "",
    status: user.status,
    profilePhotoPath: user.profilePhotoPath ?? "",
    password: "",
    passwordConfirmation: ""
  };
}
