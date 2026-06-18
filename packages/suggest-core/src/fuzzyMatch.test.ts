import assert from "node:assert/strict";
import test from "node:test";
import { getMatchingSuggestions } from "./fuzzyMatch";

test("getMatchingSuggestions prefers prefix matches and aliases", () => {
  const suggestions = getMatchingSuggestions("monash", [
    {
      id: "monash",
      label: "Monash University",
      value: "Monash University",
    },
    {
      id: "melbourne",
      label: "The University of Melbourne",
      value: "The University of Melbourne",
      matchText: "The University of Melbourne University of Melbourne",
    },
  ]);

  assert.equal(suggestions[0]?.id, "monash");
});

test("getMatchingSuggestions matches all query terms", () => {
  const suggestions = getMatchingSuggestions("south wales", [
    {
      id: "unsw",
      label: "UNSW Sydney",
      value: "UNSW Sydney",
      matchText: "UNSW Sydney University of New South Wales",
    },
    {
      id: "sydney",
      label: "The University of Sydney",
      value: "The University of Sydney",
    },
  ]);

  assert.equal(suggestions[0]?.id, "unsw");
});
