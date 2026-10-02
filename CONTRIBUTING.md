# Contributing

If you have a suggestion for a feature or change, please open an issue to discuss it.

## Setup

```bash
pnpm install
```

## Testing

```bash
pnpm test                  # Vitest unit tests
pnpm test:integration      # Astro build + dev-server tests against the fixture site
pnpm test:consumer-types   # Build declarations and type-check a consumer
pnpm verify                # Fix lint, check deps, run unit + integration tests
```

The integration tests run under `node:test` rather than Vitest because Vitest mirrors its own `import.meta.env` flags into `process.env`, which changes Astro's build and dev behavior.

## Code style

[Biome](https://biomejs.dev/) formats and lints (`pnpm fix`, `pnpm check`). [knip](https://knip.dev/) checks for unused files and dependencies (`pnpm check:deps`). Use [Conventional Commits](https://www.conventionalcommits.org/).
