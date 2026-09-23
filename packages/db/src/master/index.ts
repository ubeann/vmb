import type {
  Division,
  DivisionInput,
  DivisionListQuery,
  DivisionListResponse,
  Role,
  RoleInput,
  RoleListQuery,
  RoleListResponse,
  User,
  UserCreateInput,
  UserListQuery,
  UserListResponse,
  UserUpdateInput
} from "@vmb/types";
import type { MasterDb } from "./db.js";
import {
  createDivision,
  deleteDivision,
  getDivision,
  listDivisions,
  restoreDivision,
  updateDivision
} from "./divisions.js";
import { createRole, deleteRole, getRole, listRoles, updateRole } from "./roles.js";
import {
  createUser,
  deleteUser,
  getSignInEligibility,
  getUser,
  listUsers,
  restoreUser,
  updateUser
} from "./users.js";
import type { SignInEligibility, UserStoreOptions } from "./users.js";

export * from "./db.js";
export * from "./errors.js";
export type { SignInEligibility, UserStoreOptions } from "./users.js";

/**
 * The Master module's data surface. Every method is a complete use case, so
 * the API layer above it holds only HTTP concerns and the tests below it can
 * run against embedded Postgres.
 */
export type MasterStore = {
  listDivisions(query: DivisionListQuery): Promise<DivisionListResponse>;
  getDivision(id: string): Promise<Division>;
  createDivision(input: DivisionInput): Promise<Division>;
  updateDivision(id: string, input: DivisionInput): Promise<Division>;
  deleteDivision(id: string): Promise<void>;
  restoreDivision(id: string): Promise<Division>;

  listRoles(query: RoleListQuery): Promise<RoleListResponse>;
  getRole(id: string): Promise<Role>;
  createRole(input: RoleInput): Promise<Role>;
  updateRole(id: string, input: RoleInput): Promise<Role>;
  deleteRole(id: string): Promise<void>;

  listUsers(query: UserListQuery): Promise<UserListResponse>;
  getUser(id: string): Promise<User>;
  getSignInEligibility(id: string): Promise<SignInEligibility>;
  createUser(input: UserCreateInput): Promise<User>;
  updateUser(id: string, input: UserUpdateInput): Promise<User>;
  deleteUser(id: string): Promise<void>;
  restoreUser(id: string): Promise<User>;
};

export function createMasterStore(db: MasterDb, options: UserStoreOptions): MasterStore {
  return {
    listDivisions: (query) => listDivisions(db, query),
    getDivision: (id) => getDivision(db, id),
    createDivision: (input) => createDivision(db, input),
    updateDivision: (id, input) => updateDivision(db, id, input),
    deleteDivision: (id) => deleteDivision(db, id),
    restoreDivision: (id) => restoreDivision(db, id),

    listRoles: (query) => listRoles(db, query),
    getRole: (id) => getRole(db, id),
    createRole: (input) => createRole(db, input),
    updateRole: (id, input) => updateRole(db, id, input),
    deleteRole: (id) => deleteRole(db, id),

    listUsers: (query) => listUsers(db, query),
    getUser: (id) => getUser(db, id),
    getSignInEligibility: (id) => getSignInEligibility(db, id),
    createUser: (input) => createUser(db, options, input),
    updateUser: (id, input) => updateUser(db, options, id, input),
    deleteUser: (id) => deleteUser(db, id),
    restoreUser: (id) => restoreUser(db, id)
  };
}
