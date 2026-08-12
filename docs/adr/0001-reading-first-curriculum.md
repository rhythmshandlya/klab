# ADR-0001: Keep the Curriculum reading-first

- Status: Accepted
- Date: 2026-08-12

## Context

An earlier Curriculum design proposed a gated mission player with a separate journey home,
one section visible at a time, and diagram-specific mission state. That structure duplicated
navigation already provided by the Docs routes and made the lesson harder to scan, reference,
and revisit while using the embedded cluster tools.

The shipped Curriculum now presents lessons as readable documents and embeds interactive
missions where they support the explanation. The Docs home uses the learning roadmap as its
single entry point.

## Decision

Keep Curriculum lessons reading-first. Readers can move through the full lesson naturally,
while embedded missions may expose the editor, terminal, topology, and validation tools without
replacing the document with a gated player.

Use the learning roadmap for Curriculum discovery. Do not maintain parallel journey-home,
section-player, or mission-diagram interfaces unless a future product decision explicitly
reintroduces and owns that experience.

## Consequences

- Lesson content remains easy to scan, link to, and read alongside interactive tools.
- Progress and mission state belong to the embedded lab experience, not a second navigation model.
- Retired gated-player modules and their tests can be removed without introducing replacement
  abstractions.
- A future gated experience requires a new decision that explains why it improves on the
  reading-first model.
