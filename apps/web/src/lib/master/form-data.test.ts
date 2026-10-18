import type { Division, RoleDetail, User } from "@vmb/types";
import { superValidate } from "sveltekit-superforms/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { describe, expect, it } from "vitest";
import { RoleFormSchema, divisionFormData, roleFormData, userFormData } from "./form-data.js";

const STAMP = "2026-01-05T01:10:00.123Z";
const ID = "d1000000-0000-4000-8000-000000000001";

const division: Division = {
  id: ID,
  name: "Operations",
  code: "OPS",
  description: null,
  colorHex: "#2563EB",
  iconName: "settings",
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

const role: RoleDetail = {
  id: ID,
  name: "Staff",
  isActive: true,
  isSystem: false,
  colorHex: "#805AD5",
  iconName: "user",
  description: null,
  divisionId: null,
  divisionName: null,
  divisionInactive: false,
  userCount: 0,
  permissionCount: 2,
  permissionKeys: ["master-users.view", "master-users.view_any"],
  createdAt: STAMP,
  updatedAt: STAMP
};

const user: User = {
  id: ID,
  name: "Rina Wijaya",
  status: "active",
  roles: [],
  divisions: [],
  phone: null,
  email: "rina@vmblogistics.id",
  emailVerified: false,
  profilePhotoPath: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null
};

describe("edit form data", () => {
  it("carries the exact updatedAt the API served, for the save to be checked against", () => {
    expect(divisionFormData(division).updatedAt).toBe(STAMP);
    expect(roleFormData(role).updatedAt).toBe(STAMP);
    expect(userFormData(user).updatedAt).toBe(STAMP);
  });

  it("carries a record that was never stamped as null", () => {
    expect(divisionFormData({ ...division, updatedAt: null }).updatedAt).toBeNull();
    expect(roleFormData({ ...role, updatedAt: null }).updatedAt).toBeNull();
    expect(userFormData({ ...user, updatedAt: null }).updatedAt).toBeNull();
  });

  it("loads a role's Division, or none for every Division, so a save that changes nothing else keeps it", () => {
    expect(roleFormData(role).divisionId).toBeNull();
    expect(roleFormData({ ...role, divisionId: ID, divisionName: "Hub" }).divisionId).toBe(ID);
  });

  it("loads a role's grants, so a save that changes nothing else keeps them", () => {
    expect(roleFormData(role).permissionKeys).toEqual([
      "master-users.view",
      "master-users.view_any"
    ]);
  });
});

describe("the Role form's Division, as a post carries it", () => {
  const post = (divisionId?: string) => {
    const data = new FormData();
    data.set("name", "Staff");
    if (divisionId !== undefined) data.set("divisionId", divisionId);
    return superValidate(data, zod4(RoleFormSchema));
  };

  it("reads the empty choice, Every division, as null and valid", async () => {
    const parsed = await post("");

    expect(parsed.valid).toBe(true);
    expect(parsed.data.divisionId).toBeNull();
  });

  it("reads a Division's id as it is, and refuses text that is not an id", async () => {
    await expect(post(ID)).resolves.toMatchObject({ valid: true, data: { divisionId: ID } });
    await expect(post("hub")).resolves.toMatchObject({ valid: false });
  });
});
