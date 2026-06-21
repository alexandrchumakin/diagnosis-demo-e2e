#!/usr/bin/env node

import fs from "node:fs";

const marker = "<!-- diagnosis-demo-ai-analysis -->";
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const bodyPath = process.argv[2] ?? "artifacts/ai-analysis.md";

if (!token || !repository || !prNumber) {
  console.log("Skipping PR comment: GITHUB_TOKEN, GITHUB_REPOSITORY, or PR_NUMBER is missing.");
  process.exit(0);
}

if (!fs.existsSync(bodyPath)) {
  console.log(`Skipping PR comment: ${bodyPath} does not exist.`);
  process.exit(0);
}

const [owner, repo] = repository.split("/");
const analysis = fs.readFileSync(bodyPath, "utf8").trim();
const commentBody = `${marker}\n# AI failure diagnosis\n\n${analysis}`;
const apiBase = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const existing = await github(`/repos/${owner}/${repo}/issues/${prNumber}/comments`);
const previous = existing.find((comment) => comment.body?.includes(marker));

if (previous) {
  await github(`/repos/${owner}/${repo}/issues/comments/${previous.id}`, {
    method: "PATCH",
    body: JSON.stringify({ body: commentBody }),
  });
  console.log(`Updated AI diagnosis comment ${previous.id}.`);
} else {
  const created = await github(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: commentBody }),
  });
  console.log(`Created AI diagnosis comment ${created.id}.`);
}

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body.message || `GitHub API failed with ${response.status}`);
  }

  return body;
}
