# Ubiquitous Language

The words used in code, UI copy, configuration, docs and specs for Progression Radar. When two words exist for the
same concept, use the one in **bold** and avoid the aliases.

## The ladder (content)

| Term                        | Definition                                                                                                   | Aliases to avoid                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Ladder**                  | The whole progression content of a deployment: its **Categories**, their **Expectations** and its **Roles**. | Path, career path, framework, matrix                                 |
| **Category**                | An area of the **Ladder** in which a **Person** progresses, e.g. Communication or AI Systems.                | Area (outside UI copy), skill, axis, dimension                       |
| **Category key**            | The short, stable identifier of a **Category**, used in **Roles** and in the **Share link**.                 | Id, slug, code                                                       |
| **Expectation**             | A skill, behaviour or concept expected of a **Person** at one **Level** of one **Category**.                 | KPI (legacy name), competency, criterion, milestone, behaviour, item |
| **Expectation summary**     | The one-line title of an **Expectation**.                                                                    | KPI summary, name, title                                             |
| **Expectation description** | The Markdown body of an **Expectation**, usually its example behaviours.                                     | KPI description, details, body                                       |
| **Level**                   | A step within a **Category**: level 0 plus every level used by the **Category**'s **Expectations**.          | Grade, rank, stage, step                                             |
| **Highest level**           | The largest **Level** of a **Category**, which counts as 100 %.                                              | Max level, top level                                                 |
| **Role**                    | A step of the **Ladder** with the **Required level** it sets for each **Category**.                          | Position, job, title, grade                                          |
| **Role key**                | The short, stable identifier of a **Role**, used in the **Share link**.                                      | Id, slug                                                             |
| **Required level**          | The **Level** a **Role** requires in a **Category**; 0 when the **Role** does not mention it.                | Target level, expected level, role level                             |

## The person and the comparison

| Term                 | Definition                                                                                                       | Aliases to avoid                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Person**           | The individual being shown: **Name**, **Reached levels**, **Current role**, **Person tags** and **Compared role**. | User, employee, profile, state         |
| **Reached level**    | The **Level** a **Person** has reached in one **Category**.                                                      | Current level, score, value            |
| **Current role**     | The **Role** the **Person** holds today; read from the **Share link**, not editable in the UI.                   | Role (unqualified), own role           |
| **Compared role**    | The **Role** whose **Required levels** are drawn next to the **Person**'s; chosen with "Compare to".             | Target role, compare role, goal role   |
| **Person tag**       | A free label attached to a **Person** in the **Share link**; shown but not editable.                             | Tag (unqualified), label               |
| **Seal**             | The mark with the **Person**'s initials (a hanko in the default theme).                                         | Avatar, badge, initials                |
| **Example person**   | The **Person** shown when there is no **Share link** or it is an **Invalid link**.                              | Default person, demo person, sample    |

## Progress

| Term                 | Definition                                                                                                   | Aliases to avoid                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| **Progress**         | A **Reached level** as a percentage of the **Highest level** of its **Category**.                            | Score, completion, percentage (alone)  |
| **Overall progress** | The average **Progress** across all **Categories**, labelled "Overall".                                      | Total score, global percentage         |
| **Radar**            | The chart with one axis per **Category** that draws the **Person**'s **Progress** and the **Compared role**. | Spider chart, graph, web               |
| **Role gap**         | How far a **Person** is from the **Compared role**: **On target** categories and **Levels to go**.           | Diff, delta, distance                  |
| **On target**        | A **Category** where the **Reached level** is at least the **Required level**.                               | Met, meets, achieved, passed           |
| **Levels to go**     | The sum, across **Categories**, of the **Levels** still missing to reach the **Required levels**.            | Missing levels, remaining, gap (alone) |

## The share link

| Term               | Definition                                                                                                          | Aliases to avoid                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Share link**     | The URL whose fragment holds the whole **Person**; it is the only place data is stored.                             | State URL, permalink, snapshot URL    |
| **Legacy link**    | A **Share link** from earlier versions, with the **Person** as JSON in `?state=`; read forever, never written.       | Old URL, v0 link                      |
| **Reserved key**   | A **Share link** field name (`name`, `role`, `compare`, `tag`, `state`), or `id`, the **Snapshot** column, that no **Category key** may use. | Keyword, forbidden key                |
| **Normalisation**  | Making a **Share link** fit the current **Configuration**: unknown keys dropped, **Levels** clamped.                | Sanitising, validation, migration     |
| **Ignored field**  | Data in a **Share link** that **Normalisation** dropped or corrected.                                               | Issue, error, warning                 |
| **Invalid link**   | A **Share link** with nothing usable, which opens the **Example person**.                                           | Broken link, bad state                |
| **Link notice**    | The dismissible, non-blocking message that names the **Ignored fields** or explains an **Invalid link**.            | Error, alert, warning, toast          |

## Snapshots

| Term                | Definition                                                                                                                                  | Aliases to avoid                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Snapshot**        | A dated CSV file, outside the app, with one row per **Person** recorded from their **Share link**. Its date is the leading `YYYY-MM-DD` of the file name. | Record file, export, backup, snapshot URL      |
| **Snapshots folder** | Where **Snapshots** live: `snapshots/` or `PROGRESSION_RADAR_SNAPSHOTS_DIR`; git-ignored upstream.                                           | Data folder, history folder                    |
| **Person id**       | The `id` the user chooses for a **Person** in **Snapshots**: unique within a **Snapshot**, and the same `id` in two **Snapshots** is the same **Person**. It does not exist in the **Share link**. | User id, key, slug                             |

## Configuration and customisation

| Term                        | Definition                                                                                                         | Aliases to avoid                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Adopter**                 | An organisation or team that deploys the radar with its own **Ladder**, from a fork, a clone or an **Adopter repository**. | Customer, client, tenant, user            |
| **Adopter repository**      | The repository an **Adopter** owns with only their **Config folder**, **Snapshots folder** and a `package.json` that depends on the radar. | Consumer repo, wrapper repo, template     |
| **Upstream**                | The original repository, which owns `src/` and the **Sample configuration**.                                       | Core, main repo, template                 |
| **Sample configuration**    | The files in `config.example/`: the demo **Ladder** and the defaults.                                              | Example config, default config, template  |
| **Config folder**           | The **Adopter**'s folder (`config/` or `PROGRESSION_RADAR_CONFIG_DIR`) whose files replace the sample ones.        | Local config, override folder, custom dir |
| **Configuration file**      | One of the `categories/` folder of **Category files** (as one unit), `roles.yml`, `site.yml` or `theme.css`, read from the **Config folder** or the sample. | Config entry, setting file                |
| **Per-file fallback**       | The rule that each **Configuration file** comes from the **Config folder** if present, else from the sample, whole. | Merge, inheritance, overlay              |
| **Resolved configuration**  | The set of **Configuration files** chosen by the **Per-file fallback** for a build.                                 | Effective config, final config            |
| **Configuration**           | The validated, typed content of the **Resolved configuration**: **Site**, **Categories** and **Roles**.             | Settings, options                         |
| **Configuration problem**   | A mistake in a **Configuration file**, named with its file and folder; all of them block rendering and fail tests. | Config error (in prose), warning          |
| **Site**                    | The deployment's branding settings: title, optional logo and optional footer.                                       | App settings, header config               |
| **Theme**                   | The colours, fonts and textures of the page; the default one can be overridden by the **Adopter**'s `theme.css`.  | Skin, style, palette                      |
| **Category file**           | A Markdown file in the `categories/` folder that defines one **Category**: its frontmatter and its **Expectations** grouped under `## Level N`. The only way to write **Categories**: a `categories.yml` is no longer read. | Category document, category page          |

## Relationships

- A **Ladder** has one or more **Categories** and zero or more **Roles**.
- A **Category** has many **Expectations**; each **Expectation** belongs to exactly one **Category** and one **Level**
  of it.
- A **Category**'s **Levels** are derived from its **Expectations** (plus level 0); they are never declared on their
  own.
- A **Role** has at most one **Required level** per **Category**.
- A **Snapshot** holds many **Persons**, one row each with a **Person id**; a row converts to a **Share link** and back.
  A **Category** with no column in a **Snapshot** is "not recorded", which is not **Level** 0.
- A **Share link** holds exactly one **Person**; a **Person** has one **Reached level** per **Category**, at most one
  **Current role** and at most one **Compared role**.
- The **Role gap** exists only while there is a **Compared role**; the **Current role** plays no part in it.
- **Normalisation** produces zero or more **Ignored fields**, and any of them, or an **Invalid link**, produces one
  **Link notice**.
- A **Configuration problem** blocks the app; a **Link notice** never does.

## Example dialogue

> **Dev:** "When a **Person** picks a **Compared role**, do we compare it with their **Current role**?"

> **Domain expert:** "No. The **Current role** is just shown under the **Name**. The **Role gap** is always the
> **Person**'s **Reached levels** against the **Required levels** of the **Compared role**."

> **Dev:** "And if an **Adopter** removes a **Category** from their **Ladder**, what happens to a **Share link**
> that still has it?"

> **Domain expert:** "**Normalisation** drops it and the **Link notice** names it as an **Ignored field**. The link
> still opens. Only a **Configuration problem**, like a **Category key** that is a **Reserved key**, stops the app."

> **Dev:** "So **Progress** in a **Category** with three **Levels** and one with five is still comparable on the
> **Radar**?"

> **Domain expert:** "Yes, because **Progress** is the **Reached level** over the **Highest level** of that
> **Category**. And a **Category** is **On target** as soon as the **Reached level** is at least the **Required
> level**, whatever its **Progress**."

## Flagged ambiguities

- **"Role" means two things.** The `role` parameter and `Person.roleKey` are the **Current role**, while `compare` /
  `compareTo` is the **Compared role**. Always qualify the word when talking about a **Person**; unqualified
  "Role" refers only to the **Ladder** entry.
- **"Level" is overloaded.** It names a step of a **Category**, the **Reached level**, the **Required level** and the
  `levels` maps in both `Person` and `Role`. Qualify it whenever it is not the bare step.
- **"Target" vs "Compared role" vs "Required level".** The UI uses "Target" for the **Required level** mark and "On
  target" for the **Role gap**. Keep "Target" as UI copy only; in code and specs say **Required level** and
  **Compared role**. Avoid "target role".
- **"Area" vs "Category".** The UI labels the category list "Areas" and the docs say "an area of the path". Use
  **Category** everywhere except that UI label; consider renaming the label to "Categories" for consistency.
- **"Path" vs "Ladder".** The docs use "career and learning path" for the product's subject and "ladder" for the
  configured content. Use **Ladder** for the configured content; "path" is fine only in marketing prose.
- **"Person" vs "user".** `ARCHITECTURE.md` speaks of "the user's data". The data belongs to the **Person**; "user"
  is ambiguous between the **Person**, a manager looking at their link and an **Adopter**.
- **"State".** Used for the **Person** in the URL, the legacy `?state=` parameter and React UI state (the selected
  **Category**). Say **Person** for the data, **Legacy link** for `?state=`, and "UI state" for what is not in the
  **Share link**.
- **"Issues" in code vs "Ignored fields" in UI.** `parseState()` returns `issues`, and the **Link notice** says
  "ignored or corrected". Prefer **Ignored field** in prose, so it is not confused with the issue tracker or a
  **Configuration problem**.
- **"KPI" was the wrong word.** A KPI is a measured indicator with a numeric target; what a **Category** lists per
  **Level** is qualitative and is demonstrated, not measured, so it is an **Expectation**. "KPI" survives only as a
  legacy name: the converter still reads the `kpis:` key of an old `categories.yml`, and the `.kpi*` class names and
  `--kpi-index` are still on the page so existing themes keep working. "Expects" is reserved for **Expectations**: a **Role** *requires*
  a **Level**.
- **"Met" / "meets" / "On target".** The code says `met`, the category nav says "meets <role>" and the summary says
  "On target". They are the same concept: **On target**.
