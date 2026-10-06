/** A record the caller named does not exist. */
export class MasterNotFoundError extends Error {
  constructor(message = "Record not found.") {
    super(message);
    this.name = "MasterNotFoundError";
  }
}

/** A unique business key is already taken. */
export class MasterConflictError extends Error {
  constructor(message = "That value is already taken.") {
    super(message);
    this.name = "MasterConflictError";
  }
}

/** The legacy policy refuses to modify a system role (`RolePolicy.php`). */
export class MasterSystemRoleError extends Error {
  constructor(message = "System roles cannot be modified or deleted.") {
    super(message);
    this.name = "MasterSystemRoleError";
  }
}

/** The caller may not change a role that carries permissions they do not hold. */
export class MasterForbiddenError extends Error {
  constructor(message = "You cannot change a role that carries permissions you do not have.") {
    super(message);
    this.name = "MasterForbiddenError";
  }
}
