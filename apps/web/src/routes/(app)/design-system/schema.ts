import { z } from "zod";

// A throwaway schema for the showcase form — not a domain schema.
export const DemoSchema = z.object({
  name: z.string().trim().min(3, "Name needs at least 3 characters"),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{3,5}$/, "Code is 3–5 uppercase letters"),
  division: z.string().min(1, "Choose a division")
});

export const DEMO_DIVISIONS = [
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "trucking", label: "Trucking" }
] as const;
