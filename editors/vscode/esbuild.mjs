import esbuild from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const production = process.argv.includes("--production");

// vscode-languageclient calls `Minimatch#makeRe()`, which minimatch 11 removed.
// Send every `minimatch` import in the bundle through a shim that restores it;
// the shim's own import of the real package resolves normally.
const minimatchShim = resolve("src/minimatch-compat.ts");
const minimatchCompat = {
  name: "minimatch-compat",
  setup(build) {
    build.onResolve({ filter: /^minimatch$/ }, (args) =>
      args.importer.replaceAll("\\", "/").endsWith("/src/minimatch-compat.ts")
        ? undefined
        : { path: minimatchShim },
    );
  },
};

if (production) {
  await rm("dist/extension.js.map", { force: true });
}

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: !production,
  minify: production,
  plugins: [minimatchCompat],
});

if (!production) {
  await esbuild.build({
    entryPoints: ["test/suite/*.test.ts"],
    bundle: true,
    outdir: "out/test",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    target: "node18",
    sourcemap: true,
    plugins: [minimatchCompat],
  });
}
