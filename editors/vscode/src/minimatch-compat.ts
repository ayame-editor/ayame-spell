// vscode-languageclient depends on minimatch 10, whose denial-of-service
// advisory (GHSA-g3hv-75wg-m249) is fixed only in minimatch 11. The package
// `overrides` therefore install minimatch 11 for the bundled client.
//
// minimatch 11 no longer builds regular expressions, so `Minimatch#makeRe()`
// is gone, but the client still calls it in three places (file-operation
// registration, pull-diagnostic filters and notebook filters). It only asks
// whether the pattern is usable: a falsy result means the pattern can never
// match anything. `esbuild.mjs` routes every `minimatch` import in the bundle
// through this module, which restores that one method.
//
// Remove this file, the esbuild plugin, and the `minimatch` override once a
// vscode-languageclient release depends on minimatch 11 or later.
import { Minimatch } from "minimatch";

export * from "minimatch";

const prototype = Minimatch.prototype as { makeRe?: () => unknown };

if (typeof prototype.makeRe !== "function") {
  // Empty patterns and `#comment` patterns parse to no rows, exactly the
  // cases for which minimatch 10 returned `false`. Callers only test the
  // result for truthiness, so a boolean stands in for the old RegExp.
  prototype.makeRe = function (this: Minimatch): boolean {
    return this.set.length > 0;
  };
}
