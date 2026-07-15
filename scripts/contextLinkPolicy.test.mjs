import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRepositoryMarkdownLink } from "./contextLinkPolicy.mjs";

describe("repository Markdown link policy", () => {
  const repositoryRoot = "/repo/Application";

  it("accepts a relative link that resolves inside the repository", () => {
    assert.equal(
      resolveRepositoryMarkdownLink({
        repositoryRoot,
        sourceFile: "docs/runbooks/backend.md",
        target: "../../supabase/migrations/0001_initial.sql",
      }).isRepositoryLocal,
      true,
    );
  });

  it("rejects an absolute machine-specific path", () => {
    assert.equal(
      resolveRepositoryMarkdownLink({
        repositoryRoot,
        sourceFile: "docs/runbooks/backend.md",
        target: "/Users/example/Application/supabase/migrations/0001_initial.sql",
      }).isRepositoryLocal,
      false,
    );
  });

  it("rejects a relative link that escapes to a sibling checkout", () => {
    assert.equal(
      resolveRepositoryMarkdownLink({
        repositoryRoot,
        sourceFile: "docs/contracts/suggest.v1.md",
        target: "../../../suggest-service/docs/contracts/suggest.v1.md",
      }).isRepositoryLocal,
      false,
    );
  });
});
