# Deployment

`npm run build` produces a static site in `dist/` with relative paths, so it can be served from any static host, at
the root of a domain or in a sub-folder. The repository includes a `netlify.toml` for Netlify.

## Keeping your fork up to date

Upstream updates merge without conflicts as long as your changes stay in your config folder (`config/`, or the one in
`PROGRESSION_RADAR_CONFIG_DIR`) and `src/` and `config.example/` are untouched:

```sh
git remote add upstream https://github.com/asiermarques/progression-radar.git
git pull upstream master
npm install
```

See also: [Configuration](configuration.md) (including `PROGRESSION_RADAR_CONFIG_DIR` on Netlify) and
[Upgrading](upgrading.md).
