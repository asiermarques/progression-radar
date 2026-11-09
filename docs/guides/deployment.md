# Deployment

`npm run build` produces a static site in `dist/` with relative paths, so it can be served from any static host, at
the root of a domain or in a sub-folder. It works the same in an
[adopter repository](getting-started.md#install-it-as-a-dependency-recommended) and in a fork: `dist/` is written in
the root of the repository.

The build fails, listing every configuration problem with its file and folder, when your configuration is invalid, so
a CI never deploys a site that only shows the problems. Run the check first in your pipeline:

```sh
npm ci && npm run check && npm run build
```

`npm run check` validates the configuration and your snapshots (when you keep them in the repository) and exits with an
error code when either has an error; snapshot warnings do not fail it.

## Netlify

A fork already has the `netlify.toml` of the radar. In an adopter repository, add the same file at its root:

```toml
# netlify.toml
[build]
  command = "npm run check && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "24"
```

If your configuration is not in `config/`, set `PROGRESSION_RADAR_CONFIG_DIR` under *Site configuration → Environment
variables* (see [Configuration](configuration.md)).

## Other hosts

Any host that runs a build command works the same way: install with `npm ci`, build with `npm run build` (after
`npm run check`) and publish the `dist/` folder, with Node 22.12 or newer. To build elsewhere and upload the files,
copy the contents of `dist/` to the host.

## Keeping it up to date

- **Adopter repository:** change the version of the dependency. See
  [Upgrading an adopter repository](upgrading.md#an-adopter-repository).
- **Fork:** merge upstream, as below.

### Keeping your fork up to date

Upstream updates merge without conflicts as long as your changes stay in your config folder (`config/`, or the one in
`PROGRESSION_RADAR_CONFIG_DIR`) and `src/` and `config.example/` are untouched:

```sh
git remote add upstream https://github.com/asiermarques/progression-radar.git
git pull upstream master
npm install
```

See also: [Configuration](configuration.md) (including `PROGRESSION_RADAR_CONFIG_DIR` on Netlify) and
[Upgrading](upgrading.md).
