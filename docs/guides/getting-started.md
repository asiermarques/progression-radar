# Getting started

You need [Node.js](https://nodejs.org) 22.12 or newer. Node 24 LTS is recommended (see `.nvmrc`): npm 10 can fail
while resolving the test dependencies.

```sh
git clone git@github.com:asiermarques/progression-radar.git
cd progression-radar
npm install
npm run dev
```

To use it for your own organisation, fork the repository, put your files in [`config/`](../../config) and deploy it
(see [Configuration](configuration.md) and [Deployment](deployment.md)).

## Scripts

| command             | description                                             |
|---------------------|---------------------------------------------------------|
| `npm run dev`       | starts the development server with hot reload           |
| `npm test`          | runs the tests in watch mode (`npm test -- --run` once) |
| `npm run typecheck` | type-checks the project                                 |
| `npm run build`     | type-checks and builds the static site into `dist/`     |
| `npm run preview`   | serves the production build locally                     |
| `npm run config:migrate` | moves a fork's edits out of `config.example/` (see [Upgrading](upgrading.md)) |
| `npm run config:convert-categories` | converts `categories.yml` into [category files](categories.md#converting-an-existing-categoriesyml) |
| `npm run snapshot:record` | saves a share link in a dated [snapshot](snapshots.md) |
| `npm run snapshot:link` | prints the share link of a recorded person |
| `npm run snapshot:check` | checks the snapshots against the current configuration |

## Next steps

- Make it yours: [Configuration](configuration.md), [Categories](categories.md), [Roles](roles.md) and [Styles](styles.md).
- Put it online and keep your fork up to date: [Deployment](deployment.md).
- Keep a record of people over time: [Snapshots](snapshots.md).
