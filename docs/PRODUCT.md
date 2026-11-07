# Product

Progression Radar is a simple visualisation tool for career and learning paths. It shows the level a person has
reached in each area of a path, and compares it with the levels a role requires. It is inspired by Medium's
deprecated Snowflake tool.

Live demo: https://progression-radar.netlify.app

## Who it is for

- **People on a path**: an individual contributor who wants to see where they stand and what is missing for a
  role.
- **Managers and mentors**: someone who discusses progression with a person and shares a snapshot of it, e.g.
  for a one-to-one or a growth plan.
- **Adopters**: an organisation or team that forks the repository, puts its own ladder in `config/` and deploys
  it.

## Core concepts

| concept    | meaning                                                                                       |
|------------|-----------------------------------------------------------------------------------------------|
| Category   | an area of the path, e.g. Communication or Backend. Configured in `config/categories.yml`     |
| KPI        | a skill, behaviour or concept expected at a given level of a category                          |
| Level      | how far a person is in a category. Level 0 plus every level used by the category's KPIs        |
| Role       | a step of the ladder, with the level it requires in each category. Configured in `config/roles.yml` |
| Person     | the person being shown: name, reached levels, current role, tags and the role compared to      |
| Compare to | the role whose required levels are drawn next to the person's on the radar                     |
| Share link | the URL that holds the whole state of the person, so it can be bookmarked or sent              |

## What it does

- Draws a radar chart with the level reached in every category, as a percentage of the highest level of that
  category. Clicking a category on the chart opens it.
- Compares the person with any configured role: the role's levels on the same radar, the required level marked in
  the level selector, and a summary of the categories on target and the levels still to go.
- Lists, for each category, the KPIs expected at every level, with Markdown descriptions.
- Lets the person edit their name, their levels and the compared role. The current role and the tags are read
  from the share link but cannot be edited in the UI.
- Keeps the share link up to date with every change, and copies it with a button.
- Offers light and dark themes (following the system setting), a responsive layout and a print-friendly page.
- Lets adopters change the content, title, logo, footer and styles from the `config/` folder.

## Product decisions

- **No backend, no accounts.** Nothing is stored anywhere except the share link. Sharing a person means sending
  the link.
- **Old links keep working.** Links created by earlier versions must keep opening. When the configuration changes,
  unknown categories and roles in a link are ignored and levels are clamped, instead of rejecting the link.
- **Readable share links.** The share link should be short, readable and safe to paste in chat, e-mail or
  documents, and the person's data should not reach the server. See
  [ADR 0001](adr/0001-readable-share-url-format.md) (accepted, not implemented yet: links are still JSON in
  `?state=`).
- **Customisation by forking.** Adopters edit `config/` only, so upstream updates merge cleanly. Deeper changes are
  done by changing `src/` in the fork.
- **Configuration mistakes are shown, not hidden.** An invalid configuration lists every problem instead of
  rendering, and fails the tests.
- **The default theme is only a default.** It is inspired by Japanese print, but every colour, font and texture can
  be overridden from `config/theme.css`.

## Non-goals

- Storing people, history or progress on a server, or any login.
- An in-app editor for categories, KPIs or roles: they are edited in the YAML files.
- Being an npm package or library that other projects depend on and override (removed in 1.0).
- Comparing several people at once: a link holds one person.

## Not shown yet

- KPI tags are part of the configuration but are not shown in the UI.
