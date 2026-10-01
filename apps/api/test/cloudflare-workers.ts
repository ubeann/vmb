// `cloudflare:workers` exists only inside the Workers runtime, so the node test
// environment resolves it here (vitest.config.ts). Outside a Worker there is no
// request lifetime to extend: a task handed to `waitUntil` simply runs on.
export function waitUntil(_promise: Promise<unknown>): void {}
