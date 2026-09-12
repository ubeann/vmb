import { z } from "zod";

export const HealthResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    db: z.literal("connected"),
    timestamp: z.string().datetime()
  }),
  z.object({
    status: z.literal("error"),
    db: z.literal("unreachable"),
    timestamp: z.string().datetime()
  })
]);

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
