import type {
  Access,
  BulkRequest,
  BulkResponse,
  Division,
  DivisionDetail,
  DivisionInput,
  DivisionListRequest,
  DivisionListResponse,
  DivisionUpdateInput,
  Role,
  RoleDetail,
  RoleInput,
  RoleListRequest,
  RoleListResponse,
  RoleUpdateInput,
  User,
  UserCreateInput,
  UserListRequest,
  UserListResponse,
  UserUpdateInput
} from "@vmb/types";
import type { MasterDb } from "./db.js";
import {
  bulkDivisions,
  createDivision,
  deleteDivision,
  getDivision,
  listDivisions,
  restoreDivision,
  setDivisionActive,
  updateDivision
} from "./divisions.js";
import { getAccess, getPermissions } from "./access.js";
import type { Actor } from "./guards.js";
import { createRole, deleteRole, getRole, listRoles, updateRole } from "./roles.js";
import {
  bulkUsers,
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
export type { Actor } from "./guards.js";
export type { SignInEligibility, UserStoreOptions } from "./users.js";

/**
 * The Master module's data surface. Every method is a complete use case, so
 * the API layer above it holds only HTTP concerns and the tests below it can
 * run against embedded Postgres.
 */
export type MasterStore = {
  /** The caller's permission keys, in one statement; read once per request. */
  getPermissions(userId: string): Promise<string[]>;
  getAccess(userId: string): Promise<Access>;

  listDivisions(query: DivisionListRequest): Promise<DivisionListResponse>;
  getDivision(id: string): Promise<DivisionDetail>;
  createDivision(input: DivisionInput): Promise<Division>;
  updateDivision(id: string, input: DivisionUpdateInput): Promise<Division>;
  deleteDivision(id: string): Promise<void>;
  restoreDivision(id: string): Promise<Division>;
  setDivisionActive(id: string, isActive: boolean): Promise<Division>;
  /** Delete or restore several divisions, all or none (#305). */
  bulkDivisions(request: BulkRequest): Promise<BulkResponse>;

  listRoles(query: RoleListRequest): Promise<RoleListResponse>;
  getRole(id: string): Promise<RoleDetail>;
  createRole(input: RoleInput): Promise<Role>;
  updateRole(id: string, input: RoleUpdateInput): Promise<Role>;
  deleteRole(id: string): Promise<void>;

  listUsers(query: UserListRequest): Promise<UserListResponse>;
  getUser(id: string): Promise<User>;
  getSignInEligibility(id: string): Promise<SignInEligibility>;
  createUser(input: UserCreateInput, actor: Actor): Promise<User>;
  updateUser(id: string, input: UserUpdateInput, actor: Actor): Promise<User>;
  deleteUser(id: string, actor: Actor): Promise<void>;
  restoreUser(id: string, actor: Actor): Promise<User>;
  /** Delete or restore several users, all or none (#305). */
  bulkUsers(request: BulkRequest, actor: Actor): Promise<BulkResponse>;
};

export function createMasterStore(db: MasterDb, options: UserStoreOptions): MasterStore {
  return {
    getPermissions: (userId) => getPermissions(db, userId),
    getAccess: (userId) => getAccess(db, userId),

    listDivisions: (query) => listDivisions(db, query),
    getDivision: (id) => getDivision(db, id),
    createDivision: (input) => createDivision(db, input),
    updateDivision: (id, input) => updateDivision(db, id, input),
    deleteDivision: (id) => deleteDivision(db, id),
    restoreDivision: (id) => restoreDivision(db, id),
    setDivisionActive: (id, isActive) => setDivisionActive(db, id, isActive),
    bulkDivisions: (request) => bulkDivisions(options, request),

    listRoles: (query) => listRoles(db, query),
    getRole: (id) => getRole(db, id),
    createRole: (input) => createRole(db, input),
    updateRole: (id, input) => updateRole(db, id, input),
    deleteRole: (id) => deleteRole(db, id),

    listUsers: (query) => listUsers(db, query),
    getUser: (id) => getUser(db, id),
    getSignInEligibility: (id) => getSignInEligibility(db, id),
    createUser: (input, actor) => createUser(db, options, input, actor),
    updateUser: (id, input, actor) => updateUser(db, options, id, input, actor),
    deleteUser: (id, actor) => deleteUser(db, id, actor),
    restoreUser: (id, actor) => restoreUser(db, id, actor),
    bulkUsers: (request, actor) => bulkUsers(options, request, actor)
  };
}
