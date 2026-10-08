import type { MasterStore } from "@vmb/db";
import type { Bindings } from "../../bindings.js";
import type { PasswordBreachCheck } from "../../breached-password.js";

export type MasterEnv = {
  Bindings: Bindings;
  Variables: {
    store: MasterStore;
    /** Set by `requireSession` ahead of this app; the permission checks read it. */
    userId: string;
    /** Set by `requirePermission`: the caller's permissions, read once for this request. */
    permissions?: string[];
    /** The breached-password lookup, resolved per request so a test can swap it. */
    isPasswordBreached: PasswordBreachCheck;
  };
};
