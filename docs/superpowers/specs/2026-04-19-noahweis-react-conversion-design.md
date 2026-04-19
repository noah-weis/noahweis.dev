# noahweis.dev React/TypeScript Conversion — Design

**Date:** 2026-04-19
**Status:** Approved for implementation

## Goal

One-time conversion of the static `noahweis.dev` site (2 HTML pages + 1 CSS file + inline JS) into a React/TypeScript project. The refactor adopts modern React conventions. Visually, the new site should look "basically the same" as the original — minor, intentional improvements are acceptable; accidental drift is not. Playwright is used locally during the conversion to flag regressions.

## Decisions

| Area | Decision |
|---|---|
| Location | Replace in-place. Old files moved to `legacy/` as a Playwright baseline, removed after parity is confirmed. |
| Framework | Vite + React + TypeScript. |
| Styling | CSS Modules per component + a global `styles/globals.css` holding CSS custom properties, `@font-face`, and html/body reset. |
| Routing | SPA with `react-router-dom`. Routes `/` (home) and `/cal` (unlisted). `.htaccess` rewrite on DreamHost handles deep links. Legacy `cal.html` 301 → `/cal`. |
| Unlisted cal page | `<meta name="robots" content="noindex, nofollow">` on the route + `Disallow: /cal` in `robots.txt`. |
| Deploy | GitHub Actions builds on push to `main` and rsyncs `dist/` to DreamHost over SSH. No server-side Node required. |
| Parity validation | Playwright runs locally only. Not wired into CI. |

## Project Layout

```
noahweis.dev/
├── legacy/                         # old site, used as Playwright baseline
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # router
│   ├── routes/
│   │   ├── Home.tsx
│   │   └── Cal.tsx
│   ├── components/
│   │   ├── Landing/{.tsx,.module.css}
│   │   ├── ExperienceItem/{.tsx,.module.css}
│   │   ├── ExperiencesSection/{.tsx,.module.css}
│   │   ├── ContactSection/{.tsx,.module.css}
│   │   └── ScrollArrow/{.tsx,.module.css}
│   ├── data/experiences.ts
│   ├── styles/globals.css
│   └── types.ts
├── public/
│   ├── assets/                     # images, fonts, resume.pdf
│   ├── .htaccess
│   └── robots.txt
├── tests/visual-parity.spec.ts
├── .github/workflows/deploy.yml
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── playwright.config.ts
```

## Components

- **Landing** — headshot, name, tagline, social icons, resume button. Stateless.
- **ExperienceItem** — renders one `Experience` entry. Handles the UO variant where skills are plain text instead of icon rows.
- **ExperiencesSection** — maps the typed `experiences[]` array to `ExperienceItem`s under the "Work" heading.
- **ContactSection** — email-copy click (optional transient "Copied!" toast), LinkedIn, sponsor link.
- **ScrollArrow** — appears after 2.5s, hides on scroll. `useState` + `useEffect`.
- **Home route** — composes Landing + ExperiencesSection + ContactSection + ScrollArrow.
- **Cal route** — heading, description, Google Calendar iframe, back link. Injects `<meta name="robots" content="noindex, nofollow">` on mount.

## Typed Data

```ts
// src/types.ts
export interface Skill { icon?: string; label: string }
export interface Experience {
  company: string;
  date: string;
  title: string;
  link?: string;
  role: string;
  bullets: string[];
  skills: Skill[] | string;        // string covers the UO "System Architecture | Data Structures | Algorithms" line
  image: { src: string; alt: string };
}
```

The four current entries (Pipeworks, QuackHacks, DermoAI, University of Oregon) become typed array entries in `src/data/experiences.ts`.

## CSS-over-JS Change

The legacy inline script computes `experiencesSection.style.marginTop` from viewport height so the landing fills the first screen. The new implementation replaces this with pure CSS (`.landingPage { min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between }`). No ResizeObserver, no layout-in-JS. This is an intentional, documented behavior change that falls within "basically the same."

## Playwright Parity Testing

Local-only. Compares `legacy/` against the new React build.

**Servers:**
- `http://localhost:4173/` — a static file server (e.g. `npx serve legacy/ -p 4173`) serving the `legacy/` folder as its root.
- `http://localhost:5173/` — Vite dev server for the new React app.

**Routes compared:**
- legacy `http://localhost:4173/index.html` ↔ new `http://localhost:5173/`
- legacy `http://localhost:4173/cal.html` ↔ new `http://localhost:5173/cal`

**Breakpoints:** 1440×900 (desktop), 768×1024 (tablet boundary), 390×844 (mobile).

**Screenshot diffs:** pixel diff with a tolerance threshold. Artifacts saved side-by-side to `tests/artifacts/`.

**Interaction checks:**
- Scroll arrow appears after 2.5s, disappears on scroll.
- Email click copies `njdweis@gmail.com` to clipboard.
- Resume button navigates to `assets/pdf/resume.pdf`.
- External links use `target="_blank"`.
- `/cal` iframe renders; robots meta tag is present.

**Workflow:**
1. Capture baseline screenshots against `legacy/` before any React code exists.
2. Build the React version incrementally; re-run tests after each component lands.
3. Review any diff above threshold: accept (intentional refactor) or fix (accidental drift).

## Deployment

**`.github/workflows/deploy.yml`** — triggers on push to `main`:
1. `npm ci`
2. `npm run build`
3. Load SSH key from `SSH_PRIVATE_KEY` secret into agent
4. `rsync -az --delete dist/ $SSH_USER@$SSH_HOST:$WEBROOT_PATH/`

**Repo secrets:** `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `WEBROOT_PATH`.

**`public/.htaccess`:**
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

Redirect 301 /cal.html /cal
```

**`public/robots.txt`:**
```
User-agent: *
Disallow: /cal
```

## Out of Scope

- Tailwind or other styling rewrites beyond CSS Modules.
- CI-based visual regression testing (Playwright is local-only for this conversion).
- Content changes to experience copy or imagery.
- Performance or Lighthouse tuning beyond what Vite gives by default.
