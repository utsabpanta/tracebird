# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

Add a changeset for any user-facing change to `@tracebird/core` or
`@tracebird/cli`:

```sh
pnpm changeset
```

Pick the affected packages and a semver bump, and describe the change. On
release, `pnpm version` consumes the pending changesets to bump versions and
update changelogs, and `pnpm release` builds and publishes with public access.
