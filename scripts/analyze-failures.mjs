#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ?? "artifacts/ai-analysis.md";
const model = process.env.OPENAI_MODEL || args.model || "gpt-5.5";
const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

const junit = readText(args.junit);
const playwrightLog = readText(args["playwright-log"]);
const serviceLog = readText(args["service-log"]);
const serviceDiff = readText(args.diff);
const testSources = readTestSources(args["tests-dir"]);
const failures = parseJunitFailures(junit);

const prompt = buildPrompt({
  failures,
  junit,
  playwrightLog,
  serviceLog,
  serviceDiff,
  testSources,
});

let markdown;
if (!apiKey) {
  markdown = fallbackAnalysis({
    title: "AI analysis skipped: missing OPENAI_API_KEY",
    failures,
    serviceDiff,
    testSources,
  });
} else {
  markdown = await requestOpenAiAnalysis(prompt).catch((error) =>
    fallbackAnalysis({
      title: `AI analysis fallback: ${error.message}`,
      failures,
      serviceDiff,
      testSources,
    }),
  );
}

writeText(outputPath, normalizeMarkdown(markdown));
console.log(`AI analysis written to ${outputPath}`);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function readText(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function readTestSources(testsDir) {
  if (!testsDir || !fs.existsSync(testsDir)) {
    return "";
  }

  return fs
    .readdirSync(testsDir)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
    .sort()
    .map((file) => {
      const filePath = path.join(testsDir, file);
      return `### ${file}\n${fs.readFileSync(filePath, "utf8")}`;
    })
    .join("\n\n");
}

function parseJunitFailures(xml) {
  if (!xml) {
    return [];
  }

  const failures = [];
  const testcasePattern = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
  let testcaseMatch;
  while ((testcaseMatch = testcasePattern.exec(xml))) {
    const attrs = testcaseMatch[1];
    const body = testcaseMatch[2];
    if (!body.includes("<failure") && !body.includes("<error")) {
      continue;
    }

    const failureText = extractTag(body, "failure") || extractTag(body, "error") || "";
    failures.push({
      classname: extractAttr(attrs, "classname"),
      name: extractAttr(attrs, "name"),
      message: trim(decodeXml(stripTags(failureText)), 1600),
    });
  }

  return failures;
}

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`));
  return match?.[1] ?? "";
}

function extractAttr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return decodeXml(match?.[1] ?? "");
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function buildPrompt(context) {
  const failureSummary =
    context.failures.length > 0
      ? context.failures
          .map((failure, index) => {
            return [
              `Failure ${index + 1}: ${failure.name}`,
              failure.classname ? `Class: ${failure.classname}` : "",
              failure.message ? `Message:\n${failure.message}` : "",
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n")
      : "No parsed JUnit failures. Use raw logs below.";

  return [
    "You analyze failed UI E2E tests for a developer pull request.",
    "Goal: give the developer a concise root-cause explanation they can act on without asking QA to debug the test.",
    "",
    "Rules:",
    "- Prefer evidence from the failing assertion and service code diff.",
    "- If the diff explains the failure, say exactly which changed behavior is suspicious.",
    "- Do not blame flaky infrastructure unless logs support it.",
    "- Keep the answer short and PR-ready.",
    "- Use Markdown with these sections: Root cause, Evidence, Suggested fix.",
    "",
    "Parsed failures:",
    failureSummary,
    "",
    "Playwright test source:",
    trim(context.testSources, 10000),
    "",
    "Service diff:",
    trim(context.serviceDiff, 14000),
    "",
    "Raw JUnit XML:",
    trim(context.junit, 8000),
    "",
    "Playwright output:",
    trim(context.playwrightLog, 8000),
    "",
    "Service logs:",
    trim(context.serviceLog, 6000),
  ].join("\n");
}

async function requestOpenAiAnalysis(prompt) {
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are a senior QA automation engineer explaining failed E2E tests to service developers. Be precise, technical, and concise.",
      input: prompt,
      max_output_tokens: 1200,
    }),
  });

  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { raw: bodyText };
  }

  if (!response.ok) {
    const message = body?.error?.message || bodyText || `OpenAI request failed with ${response.status}`;
    throw new Error(message);
  }

  const text = extractResponseText(body);
  if (!text) {
    throw new Error("OpenAI response did not contain output text");
  }

  return text;
}

function extractResponseText(body) {
  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n\n");
}

function fallbackAnalysis({ title, failures, serviceDiff, testSources }) {
  const failureLines =
    failures.length > 0
      ? failures.map((failure) => `- ${failure.name}: ${firstLine(failure.message)}`).join("\n")
      : "- No parsed JUnit failure. Check Playwright logs and trace artifacts.";

  return [
    `## ${title}`,
    "",
    "### Root cause",
    "The automated AI call did not run, but the collected context is still attached as workflow artifacts.",
    "",
    "### Evidence",
    failureLines,
    "",
    serviceDiff.includes("@company.test")
      ? "- The service diff tightens customer email validation to `normalized.endsWith(\"@company.test\")`, while the E2E flow uses `sam@example.com`."
      : "- Review `artifacts/service.diff`, `test-results/junit.xml`, and the Playwright trace.",
    "",
    "### Suggested fix",
    serviceDiff.includes("@company.test")
      ? "- Restore standard customer email validation or update product requirements and tests together if the new domain restriction is intentional."
      : "- Open the Playwright trace and compare the service diff with the failed assertion.",
    "",
    "<details><summary>Test source snapshot</summary>",
    "",
    "```ts",
    trim(testSources, 2500),
    "```",
    "",
    "</details>",
  ].join("\n");
}

function normalizeMarkdown(markdown) {
  return `${markdown.trim()}\n`;
}

function trim(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value ?? "";
  }
  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`;
}

function firstLine(value) {
  return (value || "").split("\n").find(Boolean) || "No failure message";
}
