import { describe, expect, it } from "vitest";
import { extractStructuredOutput } from "./callLlm";

describe("extractStructuredOutput", () => {
  it("returns null for non-object payloads", () => {
    expect(extractStructuredOutput(null)).toBeNull();
    expect(extractStructuredOutput(undefined)).toBeNull();
    expect(extractStructuredOutput("plain string")).toBeNull();
    expect(extractStructuredOutput(42)).toBeNull();
  });

  it("prefers output_parsed when present", () => {
    const payload = {
      output_parsed: { experiences: [{ company: "Acme" }] },
      output_text: "ignored",
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Acme" }],
    });
  });

  it("parses output_text as JSON", () => {
    const payload = {
      output_text: '{"experiences":[{"company":"Beta"}]}',
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Beta" }],
    });
  });

  it("parses fenced JSON blocks inside output_text", () => {
    const payload = {
      output_text:
        "Here is the structured output:\n```json\n{\"experiences\":[{\"company\":\"Gamma\"}]}\n```",
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Gamma" }],
    });
  });

  it("recovers JSON when the model adds prose before and after the object", () => {
    const payload = {
      output_text:
        "Sure! Here you go: {\"experiences\":[{\"company\":\"Delta\"}]} let me know if you need more.",
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Delta" }],
    });
  });

  it("extracts parsed JSON from output[].content[].parsed", () => {
    const payload = {
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "ignored prose" },
            { parsed: { experiences: [{ company: "Epsilon" }] } },
          ],
        },
      ],
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Epsilon" }],
    });
  });

  it("extracts JSON from output[].content[].json when parsed is absent", () => {
    const payload = {
      output: [
        {
          type: "message",
          content: [{ json: { experiences: [{ company: "Zeta" }] } }],
        },
      ],
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Zeta" }],
    });
  });

  it("falls back to text content inside output[].content when neither parsed nor json is present", () => {
    const payload = {
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: '{"experiences":[{"company":"Eta"}]}',
            },
          ],
        },
      ],
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Eta" }],
    });
  });

  it("uses response.output_text when the top-level field is missing", () => {
    const payload = {
      response: {
        output_text: '{"experiences":[{"company":"Theta"}]}',
      },
    };
    expect(extractStructuredOutput(payload)).toEqual({
      experiences: [{ company: "Theta" }],
    });
  });

  it("returns null when no candidate yields valid JSON", () => {
    const payload = {
      output_text: "this is just prose with no JSON in it",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "still no JSON" }],
        },
      ],
    };
    expect(extractStructuredOutput(payload)).toBeNull();
  });

  it("ignores non-message items in output[]", () => {
    const payload = {
      output: [
        { type: "tool_call", name: "code_interpreter" },
        {
          type: "message",
          content: [{ parsed: { experiences: [] } }],
        },
      ],
    };
    expect(extractStructuredOutput(payload)).toEqual({ experiences: [] });
  });

  it("handles JSON arrays as the structured output", () => {
    const payload = {
      output_text: "[1, 2, 3]",
    };
    expect(extractStructuredOutput(payload)).toEqual([1, 2, 3]);
  });
});
