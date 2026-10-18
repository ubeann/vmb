// Stand-in for kit's internal `#app/paths` in the unit project. Its server
// build imports a module only the SvelteKit plugin generates; auth.test.ts
// reaches it through kit's cookie module.
export const app_dir = "_app";
export const base = "";
export const assets = "";
