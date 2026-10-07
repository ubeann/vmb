# ADR-0048: One error contract for every API reply

**Context:** `apps/api` answers errors four ways. The Master routes send `{ error, issues? }` with no code, `requireSession` sends `{ error }`, Better Auth sends `{ code, message }` on `/api/auth/*`, and everything else (`/api/me`, `/health`, an unknown path, any throw outside the Master routes) falls through to Hono's plain-text `Internal Server Error` or `404 Not Found`, because the only `onError` lives inside `createMasterRoutes`. `apps/web` therefore keeps two error readers (`lib/master/api.ts` and `lib/auth-error-copy.ts`), tells the Master module's three different 403s apart only by message text, and shows a unique-email conflict at the top of the form rather than on the email field. The domain modules still to come (warehouse, trucking, expense) would each copy the Master-named errors and their handler.

**Options considered:**

- Keep `error` and add a code: `{ error, code, issues? }`. The smallest change, but auth and the rest of the API still name the message differently.
- `{ code, message, issues? }`, the keys Better Auth already sends.
- RFC 9457 `application/problem+json`. Built for APIs with outside consumers; VMB has one typed, first-party client, so its `type` URIs would never be resolved.
- A success envelope as well (`{ success, data, message }`). The status already says whether a call succeeded, and Hono RPC infers each body's type from `c.json(...)`, so an envelope adds `.data` to every call and repeats the status as a boolean.

**Decision:**

- Every error reply from `apps/api` is JSON shaped `{ code, message, issues? }`, auth included. Success replies are not wrapped; list endpoints keep `{ items, total, page, perPage }`.
- `code` is SCREAMING_SNAKE, like Better Auth's. VMB's own codes are one closed list in `@vmb/types`: a generic code per status (`VALIDATION_FAILED`, `MALFORMED_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL`) plus a specific code only where a caller would branch on the reason (`SYSTEM_ROLE`, `PERMISSION_ESCALATION`, `ROLE_IN_USE`, `PASSWORD_BREACHED`). A code joins the list only when some caller treats it differently. The web reads `code` as any string, so a code it does not know, including Better Auth's, falls back to the generic handling for its status.
- `message` is user-facing copy for VMB's own codes, written by the API as today. The web maps only Better Auth's codes to its own copy, since those messages are written for developers.
- `issues` is `[{ path, message }]`. Validation failures fill it, and so does any domain error about one field, such as a unique-value conflict naming `email`, so the form shows the message on that field.
- Stores throw module-neutral domain errors that carry their code; no module defines error classes of its own. `apps/api` maps each class to a status once, in a root `app.onError`, and answers unknown paths in a root `app.notFound`. An unexpected error is logged and answered `INTERNAL` with generic copy, never its own message.

**Trade-offs:** The rename from `error` to `message` breaks the web reader, and `apps/api` and `apps/web` deploy separately, so for the minutes between the two deploys the old web shows its generic "Something went wrong" copy for API errors. Accepted for an internal tool rather than carrying a reader for both shapes. The closed code list makes adding a code a change to `@vmb/types`, which is the point: a code is part of the contract. Error bodies sit outside Hono RPC's inferred types, so the web still parses them with `ApiErrorSchema`.
