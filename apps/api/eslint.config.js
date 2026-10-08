// @ts-check
import { baseConfig } from "@vmb/config/eslint.config.js";

export default [
  ...baseConfig,
  {
    // The Master routes reach the database only through the store they are
    // handed. The statement budget relies on it (ADR-0045's amendment): the
    // routes' tests pin which store calls a request makes, and the store's
    // tests pin what each call costs, so a query sent from a route would slip
    // past both.
    files: ["src/routes/master/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@vmb/db",
              importNames: ["createDb", "createMasterStore", "sql"],
              message: 'Master routes reach the database through c.get("store") only.'
            }
          ],
          patterns: [
            {
              group: ["drizzle-orm", "drizzle-orm/*", "@neondatabase/*", "pg", "@electric-sql/*"],
              message: 'Master routes reach the database through c.get("store") only.'
            }
          ]
        }
      ]
    }
  }
];
