/**
 * Resolve the dashboard's `@/` path alias for `node --experimental-strip-types`.
 *
 * The chart specs are reconciled against real statements by running the REAL
 * `evaluate()` outside Next.js — a type-check cannot tell whether a formula is
 * the agreed one, and the repo has no TS bundler for tests. Node does not read
 * `tsconfig.json` `paths`, so the alias has to be mapped here.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/tests/alias-loader.mjs <test.mjs>
 */
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
