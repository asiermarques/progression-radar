---
title: Readable key-value share URL in the fragment
status: Accepted
date: 2026-11-07
tags: [persistence, data-model, maintainability, security]
---

# 0001. Readable key-value share URL in the fragment

## Context and problem statement

The app has no backend: the whole `Person` (`name`, `levels`, `roleKey`, `tags`, `compareTo`) lives in the URL
(ARCHITECTURE.md, "The URL is the database"). Today it is serialised as JSON in the `state` query parameter
(`src/urlState.ts:23`). Once percent-encoded, most of the link is escapes (`%7B%22…`): the example person takes
256 characters, it cannot be read or edited by hand, and characters such as `{`, `"` and `}` make it fragile when
pasted into chat, e-mail or documents. The question is which format a shared link should use, while keeping old
links working.

## Decision drivers

- **Maintainability:** links must be readable and hand-editable, with no custom escaping or parsing rules.
  Category and role keys are arbitrary non-empty strings (`src/config.ts:66`), so the format cannot rely on
  custom separators inside values.
- **Robustness when shared:** only URL-safe characters, and no trailing punctuation that linkifiers strip.
- **Security / privacy:** a person's name and levels are close to performance-review data and should not end up in
  server or CDN access logs.
- **Backwards compatibility:** every `?state=<JSON>` link created by earlier versions must keep opening.
- **Minimal:** no new dependencies (ARCHITECTURE.md, "Goals").

## Considered options

1. **Keep JSON in `?state=`**: no change, but long, unreadable and fragile.
2. **Base64url-encoded JSON**: URL-safe, but opaque and still long (184 characters for the example).
3. **lz-string compression**: opaque, adds a dependency, negligible gain on ~150-byte payloads.
4. **Positional levels (`l=211111`)**: shortest, but breaks when categories are reordered or added, which
   contradicts the lenient, key-based compatibility.
5. **Packed levels (`levels=comm.2_pm.1`)**: readable, but needs custom separators and escaping for arbitrary keys.
6. **Flat key-value parameters in the fragment**: one standard `URLSearchParams` entry per field and per category.

## Decision outcome

Chosen option: **"Flat key-value parameters in the fragment"**, because it is the only option that is readable,
hand-editable and paste-safe while delegating all escaping to `URLSearchParams`, and keeping the state out of
server logs.

Format:

```
#name=John+Connor&role=aswe&compare=front&tag=tech&comm=2&pm=1&des=1&ops=1&front=1&back=1
```

- `name`, `role` (`Person.roleKey`), `compare` (`Person.compareTo`): one parameter each, omitted when empty.
- `tag`: repeated once per tag.
- `<category key>=<level>`: one parameter per configured category, always written, last, so the link always ends
  in a digit and linkifiers do not trim it.
- The parsed parameters are mapped to the same object shape as before and go through the existing
  `normalizePerson()`, so the leniency rules (unknown keys dropped, levels clamped) are unchanged.
- Version discrimination is by location and parameter name: if the query has `state`, it is read as legacy JSON;
  otherwise the fragment is read in the new format. The app only writes the new format.
- `name`, `role`, `compare`, `tag` and `state` are reserved: `parseConfig()` rejects categories with those keys.

### Consequences

- **Good:** the example link drops from 256 to ~95 characters, is readable and editable by hand, survives pasting,
  and the state is never sent to the server (not in access logs or analytics). No new dependency.
- **Trade-offs:** five category keys become reserved (a config validation change for forks). Hand edits to the
  fragment do not reload the page, so the app must listen to `hashchange` and re-parse. We assume common chat and
  e-mail tools keep the fragment when a link is pasted; some corporate e-mail link rewriters might not.
- **Follow-ups:**
  - `src/urlState.ts`: new parser and writer for the fragment, legacy `?state=` read path kept forever, tests for
    both and for the round trip.
  - `src/config.ts`: reject reserved category keys.
  - `src/App.tsx`: write the fragment (debounced, wrapped in `try/catch`, not on mount), clear the legacy query
    when writing, listen to `hashchange`.
  - `src/components/ShareButton.tsx`: build the link from the `Person` instead of reading `location.href`.
  - Update ARCHITECTURE.md ("The URL is the database", "Data flow") and README ("The state in the URL").
