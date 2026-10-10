/**
 * ESM resolve hook: the dashboard's `@/` alias, plus TS's extensionless
 * relative imports. Loaded by `alias-loader.mjs`; see that file for why.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath, basename } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = pathToFileURL(resolvePath(here, "..", "..", "dashboard", "src")).href;

/** TS imports carry no extension and Node's resolver requires one. */
const withExt = (url) => (basename(url).includes(".") ? url : `${url}.ts`);

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return next(withExt(`${BASE}/${specifier.slice(2)}`), context);
  }
  const parent = context.parentURL ?? "";
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && parent.endsWith(".ts")) {
    return next(withExt(new URL(specifier, parent).href), context);
  }
  return next(specifier, context);
}
