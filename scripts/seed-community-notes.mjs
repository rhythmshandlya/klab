import { existsSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

for (const file of [".env.production.local", ".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const emailIndex = args.indexOf("--email");
const email = emailIndex >= 0 ? args[emailIndex + 1]?.trim().toLowerCase() : undefined;
if (!email) {
  console.error(
    "Usage: pnpm community:seed -- --email owner@example.com\n" +
      "The target must already be an official KLab Team account.",
  );
  process.exit(1);
}

const connection = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (!connection) throw new Error("DATABASE_URL is required.");
const sql = neon(connection);
const users = await sql`
  select "id", "name"
  from "user"
  where lower("email") = ${email} and "is_official" = true
`;
const official = users[0];
if (!official) throw new Error("No official KLab Team account matches that email.");

const notes = [
  {
    clientId: "official-note-welcome-v1",
    category: "general",
    title: "Welcome to the KLab Kubernetes community",
    body: `This is a practical space for Kubernetes questions and real debugging conversations.

Share a workload that is behaving strangely, explain the signals you have already checked, or compare approaches with another learner. You can also report KLab bugs, request product improvements, and suggest cluster failures that should become hands-on Problems.

Please remove credentials, access tokens, private hostnames, and company data before posting. The KLab Team will use this channel for product notes and direct replies.`,
    status: "open",
    pinned: true,
  },
  {
    clientId: "official-note-product-direction-v1",
    category: "feature",
    title: "What should KLab build next?",
    body: `We are deciding which parts of the Kubernetes learning workflow deserve the next round of attention.

What would make KLab more useful in your day-to-day learning or work: deeper Playground tools, more realistic cluster failures, collaborative sharing, guided explanations, or something else?

Reply with the job you are trying to complete and where the current experience slows you down. Concrete examples help us turn a request into a useful product change.`,
    status: "under-review",
    pinned: false,
  },
  {
    clientId: "official-note-problem-ideas-v1",
    category: "problem",
    title: "Which Kubernetes incident should become our next problem?",
    body: `The best KLab Problems should resemble failures engineers actually investigate: enough evidence to form a theory, several plausible causes, and a fix that can be verified from cluster state.

Tell us about a Kubernetes issue that taught you something. Readiness probes, Service selectors, DNS, scheduling, resource pressure, NetworkPolicy, storage, and rollout failures are all welcome.

Describe the symptom, the underlying cause, and the signal that finally revealed it. We will review strong ideas for the Problems catalog.`,
    status: "open",
    pinned: false,
  },
];

const created = [];
for (const note of notes) {
  const rows = await sql`
    insert into "community_discussions" (
      "author_id", "client_id", "category", "title", "body", "status", "pinned"
    ) values (
      ${official.id}, ${note.clientId}, ${note.category}, ${note.title}, ${note.body},
      ${note.status}, ${note.pinned}
    )
    on conflict ("author_id", "client_id") do nothing
    returning "id", "title"
  `;
  if (rows[0]) created.push(rows[0]);
}

const seeded = await sql`
  select "id", "title", "status", "pinned"
  from "community_discussions"
  where "author_id" = ${official.id}
    and "client_id" in (${notes[0].clientId}, ${notes[1].clientId}, ${notes[2].clientId})
  order by "created_at"
`;

console.log(
  JSON.stringify(
    {
      official: { id: official.id, name: official.name },
      created: created.length,
      notes: seeded,
    },
    null,
    2,
  ),
);
