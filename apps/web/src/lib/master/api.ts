import type { ApiClient } from "$lib/api.js";
import {
  ApiErrorSchema,
  isApiErrorCode,
  DivisionListResponseSchema,
  DivisionSchema,
  RoleListResponseSchema,
  RoleSchema,
  UserListResponseSchema,
  UserSchema,
  AccessSchema,
  type Access,
  type Division,
  type DivisionInput,
  type DivisionListRequest,
  type DivisionListResponse,
  type Role,
  type RoleInput,
  type RoleListQuery,
  type RoleListResponse,
  type User,
  type UserCreateInput,
  type UserListQuery,
  type UserListResponse,
  type UserUpdateInput,
  type ValidationIssue
} from "@vmb/types";
import type { z } from "zod";
import type { ErrorStatus } from "sveltekit-superforms";

/**
 * A reachable API answered; `ok: false` carries its status, code, copy and the
 * issues it named, so the caller can put each issue on its field and the copy
 * on the form. A transport failure is different and stays owned by the access
 * seam (issue #82), which reports it as a thrown error before this module is
 * reached.
 */
type ApiFailure = {
  ok: false;
  status: ErrorStatus;
  code: string;
  error: string;
  issues: ValidationIssue[];
};

export type ApiResult<T> = { ok: true; value: T } | ApiFailure;

/** What a page does with a failed lookup: a refusal and a miss keep their meaning, the rest is a 500. */
export function pageErrorStatus(status: number): 403 | 404 | 500 {
  return status === 403 || status === 404 ? status : 500;
}

/** The signed-in caller's permissions and divisions (`GET /api/me`). */
export function getMyAccess(client: ApiClient): Promise<ApiResult<Access>> {
  return client.api.me.$get().then((response) => read(response, AccessSchema));
}

/** The status union SvelteKit and Superforms accept on a failure response. */
function errorStatus(status: number): ErrorStatus {
  return (status >= 400 && status <= 599 ? status : 500) as ErrorStatus;
}

async function read<T>(response: Response, schema: z.ZodType<T>): Promise<ApiResult<T>> {
  if (response.ok) {
    return { ok: true, value: schema.parse(await response.json()) };
  }

  return failure(response);
}

async function readNoContent(response: Response): Promise<ApiResult<null>> {
  return response.ok ? { ok: true, value: null } : failure(response);
}

/** The code and copy for a status when the API's own can't be used. */
function generic(status: number): { code: string; error: string } {
  switch (status) {
    case 400:
      return { code: "VALIDATION_FAILED", error: "Check the form and try again." };
    case 401:
      return { code: "UNAUTHENTICATED", error: "Your session has ended. Sign in again." };
    case 403:
      return { code: "FORBIDDEN", error: "You do not have permission to do that." };
    case 404:
      return { code: "NOT_FOUND", error: "That record no longer exists." };
    case 409:
      return { code: "CONFLICT", error: "That clashes with a record that already exists." };
    default:
      return { code: "INTERNAL", error: "Something went wrong. Please try again." };
  }
}

/**
 * The one reader of an API error body (ADR-0048). The API's `message` is the
 * copy for VMB's own codes; a code this build does not know, or a body that is
 * not the contract at all, gets the generic handling for its status.
 */
async function failure(response: Response): Promise<ApiFailure> {
  const status = errorStatus(response.status);
  const body = ApiErrorSchema.safeParse(await response.json().catch(() => null));

  if (body.success && isApiErrorCode(body.data.code)) {
    const { code, message, issues = [] } = body.data;
    return { ok: false, status, code, error: message, issues };
  }

  const fallback = generic(status);
  return {
    ok: false,
    status,
    code: body.success ? body.data.code : fallback.code,
    error: fallback.error,
    issues: []
  };
}

/**
 * Query parameters are a string record on the wire; undefined keys and empty
 * value filters are dropped, and a value filter's values join with commas.
 */
function queryStrings(query: Record<string, string | number | readonly string[] | undefined>) {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    params[key] = String(value);
  }
  return params;
}

export function listDivisions(
  client: ApiClient,
  query: DivisionListRequest
): Promise<ApiResult<DivisionListResponse>> {
  return client.api.master.divisions
    .$get({ query: queryStrings(query) })
    .then((response) => read(response, DivisionListResponseSchema));
}

export function getDivision(client: ApiClient, id: string): Promise<ApiResult<Division>> {
  return client.api.master.divisions[":id"]
    .$get({ param: { id } })
    .then((response) => read(response, DivisionSchema));
}

export function createDivision(
  client: ApiClient,
  input: DivisionInput
): Promise<ApiResult<Division>> {
  return client.api.master.divisions
    .$post({ json: input })
    .then((response) => read(response, DivisionSchema));
}

export function updateDivision(
  client: ApiClient,
  id: string,
  input: DivisionInput
): Promise<ApiResult<Division>> {
  return client.api.master.divisions[":id"]
    .$patch({ param: { id }, json: input })
    .then((response) => read(response, DivisionSchema));
}

export function deleteDivision(client: ApiClient, id: string): Promise<ApiResult<null>> {
  return client.api.master.divisions[":id"].$delete({ param: { id } }).then(readNoContent);
}

export function restoreDivision(client: ApiClient, id: string): Promise<ApiResult<Division>> {
  return client.api.master.divisions[":id"].restore
    .$post({ param: { id } })
    .then((response) => read(response, DivisionSchema));
}

export function listRoles(
  client: ApiClient,
  query: RoleListQuery
): Promise<ApiResult<RoleListResponse>> {
  return client.api.master.roles
    .$get({ query: queryStrings(query) })
    .then((response) => read(response, RoleListResponseSchema));
}

export function getRole(client: ApiClient, id: string): Promise<ApiResult<Role>> {
  return client.api.master.roles[":id"]
    .$get({ param: { id } })
    .then((response) => read(response, RoleSchema));
}

export function createRole(client: ApiClient, input: RoleInput): Promise<ApiResult<Role>> {
  return client.api.master.roles
    .$post({ json: input })
    .then((response) => read(response, RoleSchema));
}

export function updateRole(
  client: ApiClient,
  id: string,
  input: RoleInput
): Promise<ApiResult<Role>> {
  return client.api.master.roles[":id"]
    .$patch({ param: { id }, json: input })
    .then((response) => read(response, RoleSchema));
}

export function deleteRole(client: ApiClient, id: string): Promise<ApiResult<null>> {
  return client.api.master.roles[":id"].$delete({ param: { id } }).then(readNoContent);
}

export function listUsers(
  client: ApiClient,
  query: UserListQuery
): Promise<ApiResult<UserListResponse>> {
  return client.api.master.users
    .$get({ query: queryStrings(query) })
    .then((response) => read(response, UserListResponseSchema));
}

export function getUser(client: ApiClient, id: string): Promise<ApiResult<User>> {
  return client.api.master.users[":id"]
    .$get({ param: { id } })
    .then((response) => read(response, UserSchema));
}

export function createUser(client: ApiClient, input: UserCreateInput): Promise<ApiResult<User>> {
  return client.api.master.users
    .$post({ json: input })
    .then((response) => read(response, UserSchema));
}

export function updateUser(
  client: ApiClient,
  id: string,
  input: UserUpdateInput
): Promise<ApiResult<User>> {
  return client.api.master.users[":id"]
    .$patch({ param: { id }, json: input })
    .then((response) => read(response, UserSchema));
}

export function deleteUser(client: ApiClient, id: string): Promise<ApiResult<null>> {
  return client.api.master.users[":id"].$delete({ param: { id } }).then(readNoContent);
}

export function restoreUser(client: ApiClient, id: string): Promise<ApiResult<User>> {
  return client.api.master.users[":id"].restore
    .$post({ param: { id } })
    .then((response) => read(response, UserSchema));
}
