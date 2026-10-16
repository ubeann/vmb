import type { Division, Role, User } from "@vmb/types";
import { describe, expect, it } from "vitest";
import { divisionFormData, roleFormData, userFormData } from "./form-data.js";

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

const role: Role = {
  id: ID,
  name: "Staff",
  isActive: true,
  isSystem: false,
  colorHex: "#805AD5",
  iconName: "user",
  description: null,
  divisionId: null,
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
});
