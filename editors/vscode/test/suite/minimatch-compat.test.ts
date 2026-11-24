import * as assert from "assert";
import * as vscode from "vscode";
import { DidCreateFilesFeature } from "vscode-languageclient/$test/common/fileOperations";
import { matchGlobPattern } from "vscode-languageclient/$test/common/utils/globPattern";
import { Minimatch } from "minimatch";

// vscode-languageclient calls Minimatch#makeRe(), which minimatch 11 removed.
// These tests drive the client's own call sites through the bundle, so they
// fail if the compat shim stops being applied.
suite("minimatch compatibility for vscode-languageclient", () => {
  const root = vscode.Uri.file(
    process.platform === "win32" ? "C:\\work\\project" : "/work/project",
  );
  const file = (...segments: string[]) =>
    vscode.Uri.joinPath(root, ...segments);

  test("makeRe reports whether a pattern is usable", () => {
    const usable = (pattern: string) =>
      Boolean(
        (
          new Minimatch(pattern, { dot: true }) as unknown as {
            makeRe(): unknown;
          }
        ).makeRe(),
      );
    assert.ok(usable("**/*.md"));
    assert.ok(usable("**/{ayame-spell.toml,ayame-words.txt}"));
    assert.ok(!usable(""), "an empty pattern can never match");
    assert.ok(!usable("#comment"), "a comment pattern can never match");
  });

  test("glob document filters match through matchGlobPattern", () => {
    assert.strictEqual(matchGlobPattern("**/*.md", file("docs", "a.md")), true);
    assert.strictEqual(
      matchGlobPattern("**/*.md", file("docs", "a.rs")),
      false,
    );
    assert.strictEqual(
      matchGlobPattern(
        { baseUri: root.toString(), pattern: "docs/**/*.md" },
        file("docs", "guide", "a.md"),
      ),
      true,
    );
    assert.strictEqual(
      matchGlobPattern(
        { baseUri: root.toString(), pattern: "docs/**/*.md" },
        file("src", "a.md"),
      ),
      false,
    );
    assert.strictEqual(
      matchGlobPattern("", file("a.md")),
      false,
      "an unusable pattern matches nothing",
    );
  });

  test("file-operation filters register, match and reject bad patterns", async () => {
    const sent: string[] = [];
    const client = {
      middleware: {},
      code2ProtocolConverter: {
        asDidCreateFilesParams: (event: { files: readonly vscode.Uri[] }) => ({
          files: event.files.map((uri) => uri.toString()),
        }),
      },
      sendNotification: async (_type: unknown, params: { files: string[] }) => {
        sent.push(...params.files);
      },
    };
    const feature = new DidCreateFilesFeature(client as never);
    try {
      feature.register({
        id: "markdown",
        registerOptions: {
          filters: [{ pattern: { glob: "**/*.md" } }],
        },
      });
      await feature.send({
        files: [file("a.md"), file("b.rs"), file(".hidden", "c.md")],
      } as vscode.FileCreateEvent);
      assert.deepStrictEqual(sent.sort(), [
        file(".hidden", "c.md").toString(),
        file("a.md").toString(),
      ]);

      assert.throws(
        () =>
          feature.register({
            id: "empty",
            registerOptions: { filters: [{ pattern: { glob: "" } }] },
          }),
        /Invalid pattern/,
      );
    } finally {
      feature.clear();
    }
  });
});
