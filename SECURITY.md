# Security Policy

## Reporting a vulnerability

If you discover a security issue, please report it privately to roberto@espaidinversions.com rather than opening a public issue.

## Dependency scanning

Dependencies are automatically scanned weekly via Dependabot (`.github/dependabot.yml`). Critical vulnerabilities can also be checked manually with `npm run audit`.

## Secrets

- Never commit `.env` files — they are in `.gitignore`
- Vercel secrets are managed via the Vercel dashboard and injected at build time
- Supabase keys are environment variables only
