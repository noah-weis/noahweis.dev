# Deployment

Production deploys run automatically on push to `main` or `live` via
`.github/workflows/deploy.yml`.

## Required repository secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | What to put in it |
|---|---|
| `SSH_PRIVATE_KEY` | Private key (entire file contents, including the `-----BEGIN ... END-----` lines) whose matching public key is installed in DreamHost's `~/.ssh/authorized_keys` |
| `SSH_HOST` | DreamHost hostname |
| `SSH_USER` | SSH username on DreamHost |
| `WEBROOT_PATH` | Absolute path to the public web root on DreamHost (e.g. `/home/<user>/<domain-dir>`) |

## Manual deploy

GitHub → Actions → Deploy → Run workflow → pick branch → Run.

## First-time key setup

See the project plan (`docs/superpowers/plans/2026-04-19-noahweis-react-conversion.md`,
Task 20) for how to generate and install the deploy key.
