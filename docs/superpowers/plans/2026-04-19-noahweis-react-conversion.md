# noahweis.dev React/TypeScript Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static noahweis.dev site into a Vite + React + TypeScript project with CSS Modules, react-router SPA, local Playwright parity tests, and a GitHub Actions deploy pipeline to DreamHost.

**Architecture:** Move all existing files into `legacy/` as a Playwright baseline. Scaffold a Vite + React + TS project in the same repo. Split the single HTML page into typed data + presentational components with scoped CSS Modules. Use react-router for `/` and `/cal` routes. Build locally, compare screenshots with the legacy site at three breakpoints, fix drift. Add a GitHub Actions workflow that rsyncs `dist/` to DreamHost over SSH.

**Tech Stack:** Vite 5, React 18, TypeScript 5, react-router-dom 6, CSS Modules, Playwright, `serve` (for the legacy baseline), GitHub Actions, rsync over SSH.

**Working directory for all steps:** `D:\vibes\noahweis.dev` (use `cd noahweis.dev` from `D:\vibes`).

**Commit convention:** Conventional commits (`feat:`, `chore:`, `test:`, `docs:`, `ci:`). Co-author trailer per repo convention.

---

### Task 1: Archive legacy files into `legacy/`

**Files:**
- Move: `index.html`, `cal.html`, `style.css`, `favicon.ico`, `assets/` → `legacy/`

- [ ] **Step 1: Create `legacy/` directory and move files**

```bash
mkdir legacy
git mv index.html legacy/
git mv cal.html legacy/
git mv style.css legacy/
git mv favicon.ico legacy/
git mv assets legacy/assets
```

- [ ] **Step 2: Verify structure**

Run: `ls legacy/`
Expected output should include: `assets`, `cal.html`, `favicon.ico`, `index.html`, `style.css`

Run: `ls` (at repo root)
Expected: only `docs/` and `legacy/` remain (plus `.git/`).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: archive pre-conversion site into legacy/

Why: preserve byte-identical baseline for Playwright parity checks
during the React/TS conversion. Will be removed after parity is
confirmed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Initialize Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`

- [ ] **Step 1: Scaffold Vite app in current directory**

Run: `npm create vite@latest . -- --template react-ts`

When prompted "Current directory is not empty... proceed?" answer `Ignore files and continue`.

- [ ] **Step 2: Install base dependencies**

Run: `npm install`

- [ ] **Step 3: Verify scaffolded files**

Run: `ls`
Expected to include: `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `public/`, `node_modules/`.

- [ ] **Step 4: Delete Vite starter content we won't keep**

```bash
rm src/App.css
rm src/index.css
rm src/assets/react.svg
rmdir src/assets
rm public/vite.svg
```

- [ ] **Step 5: Update `.gitignore`**

Open `.gitignore` and ensure it contains at minimum:

```gitignore
node_modules
dist
dist-ssr
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS
.DS_Store

# Playwright
/test-results/
/playwright-report/
/playwright/.cache/
/tests/artifacts/
```

- [ ] **Step 6: Verify build works (sanity check before we touch anything)**

Run: `npm run build`
Expected: build succeeds; output in `dist/`.

Run: `rm -rf dist`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: scaffold Vite + React + TypeScript project

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Install project dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

Run: `npm install react-router-dom`

- [ ] **Step 2: Install dev deps (Playwright + static server for legacy baseline)**

Run: `npm install -D @playwright/test serve`

- [ ] **Step 3: Install Playwright browsers**

Run: `npx playwright install chromium`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: add react-router, Playwright, and serve

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create project directory structure

**Files:**
- Create: `src/routes/`, `src/components/`, `src/data/`, `src/styles/`, `public/assets/`, `tests/`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/routes
mkdir -p src/components/Landing
mkdir -p src/components/ExperienceItem
mkdir -p src/components/ExperiencesSection
mkdir -p src/components/ContactSection
mkdir -p src/components/ScrollArrow
mkdir -p src/data
mkdir -p src/styles
mkdir -p tests
```

- [ ] **Step 2: Copy static assets from legacy into `public/assets`**

```bash
cp -r legacy/assets/* public/assets/
cp legacy/favicon.ico public/favicon.ico
```

- [ ] **Step 3: Verify asset copy**

Run: `ls public/assets/img/ | head -5`
Expected: image files (e.g. `qhw25_edit.jpg`, `linkedin.png`, etc).

Run: `ls public/assets/fonts/`
Expected: `SF-Pro-Display-Regular.otf` or similar.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: create src/ directory tree and copy assets to public/

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Write global stylesheet (`src/styles/globals.css`)

**Files:**
- Create: `src/styles/globals.css`

- [ ] **Step 1: Create `src/styles/globals.css`**

```css
:root {
  --background-color: #1c351c;
  --text-color: #eaf5fc;
  --link-color: #84c2e2;
  --red-color: #c6d89a;
  --top-spacing: 0rem;
  --section-spacing: 5vh;
  --landing-bottom-spacing: 0rem;
}

@media screen and (orientation: landscape) {
  :root { --top-spacing: 10rem; }
}

@media screen and (orientation: portrait) {
  :root { --top-spacing: 8rem; }
}

@font-face {
  font-family: "SF Pro Display";
  src: url("/assets/fonts/SF-Pro-Display-Regular.otf");
  font-display: swap;
}

html, body {
  max-width: 100%;
  overflow-x: hidden;
}

body {
  font-family: "SF Pro Display", sans-serif;
  font-size: 30px;
  margin: 0;
  padding: 0;
  background-color: var(--background-color);
  color: var(--text-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 100vh;
  height: 100%;
  padding-top: 0;
}

a, a:link, a:visited {
  color: var(--link-color);
  transition: color 0.3s ease;
  font-weight: bold;
  text-decoration: none;
}

a:hover {
  color: var(--red-color);
  text-decoration: underline;
  cursor: pointer;
}

@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

.fade-in-text {
  animation: fadeIn 3s;
}

@media screen and (max-width: 768px) {
  body { font-size: 6vw; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat: add global stylesheet with CSS variables and font-face

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Define TypeScript types (`src/types.ts`)

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface Skill {
  icon?: string;
  label: string;
}

export interface Experience {
  company: string;
  date: string;
  title: string;
  link?: string;
  role: string;
  bullets: string[];
  skills: Skill[] | string;
  image: { src: string; alt: string };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "$(cat <<'EOF'
feat: add Experience and Skill type definitions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Write experiences data (`src/data/experiences.ts`)

**Files:**
- Create: `src/data/experiences.ts`

- [ ] **Step 1: Create `src/data/experiences.ts`**

```ts
import type { Experience } from "../types";

export const experiences: Experience[] = [
  {
    company: "Pipeworks Studios",
    date: "2025 - Present",
    title: "Game engineer on unannounced original title",
    link: "https://www.pipeworks.com/",
    role: "Game Engineering Intern",
    bullets: [
      "Gained production-level experience in Unreal Engine and C#.",
      "Learned version control principles and practices.",
      "Worked alongside full-time engineers and designers.",
    ],
    skills: [
      { icon: "/assets/img/ue5-icon.png", label: "Unreal Engine" },
      { icon: "/assets/img/cs.png", label: "C#" },
      { icon: "/assets/img/p4v.png", label: "Version Control" },
    ],
    image: { src: "/assets/img/pipeworks_team.jpeg", alt: "Pipeworks Studios" },
  },
  {
    company: "QuackHacks",
    date: "2024 - Present",
    title: "Founded University of Oregon's student-run hackathon",
    link: "https://www.quackhacks.org/",
    role: "Event Director / Founder",
    bullets: [
      "Hosted 2 hackathons valued over $30,000.",
      "Logistics for 24-hour, 150+ person events.",
      "Active development on 3 hackathons.",
      "Led a team of 25 student organizers.",
      "Registered non-profit with the state of Oregon.",
    ],
    skills: [
      { icon: "/assets/img/uo_yellow.png", label: "University Newsletter" },
      { icon: "/assets/img/E-Logo-GRN.png", label: "Student Paper" },
      { icon: "/assets/img/kezi9.png", label: "Local News" },
    ],
    image: { src: "/assets/img/quackhacks.jpeg", alt: "QuackHacks" },
  },
  {
    company: "DermoAI",
    date: "2025",
    title: "Developed melanoma & skin disease deep learning models",
    link: "https://devpost.com/software/dermo",
    role: "Hackathon Project Member, UI/UX & Frontend Lead",
    bullets: [
      "BeaverHacks Best Overall Presented by NVIDIA.",
      "85% accurate melanoma detection model.",
      "The largest open-source skin disease dataset.",
      "Led UI/UX design and frontend development.",
    ],
    skills: [
      { icon: "/assets/img/react.png", label: "React" },
      { icon: "/assets/img/tailwindcss.png", label: "Tailwind CSS" },
      { icon: "/assets/img/pytorch.png", label: "PyTorch" },
    ],
    image: { src: "/assets/img/bh_stage.jpg", alt: "DermoAI" },
  },
  {
    company: "University of Oregon",
    date: "M.S. June 2027",
    title: "Accelerated Master's program in Computer Science.",
    role: "Sociology minor",
    bullets: [
      "Computer Science B.S. December 2025.",
      "Learning assistant for intro-level courses.",
      "Concentration in Software Development.",
      "Project-based learning in Machine Learning, Mobile Development, and Game Development.",
    ],
    skills: "System Architecture | Data Structures | Algorithms",
    image: { src: "/assets/img/uo_crop.jpg", alt: "University of Oregon" },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/data/experiences.ts
git commit -m "$(cat <<'EOF'
feat: add typed experience data array

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Set up Playwright config and baseline capture

**Files:**
- Create: `playwright.config.ts`, `tests/visual-parity.spec.ts`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: "npx serve legacy -p 4173 -L",
      port: 4173,
      reuseExistingServer: true,
    },
    {
      command: "npm run dev -- --port 5173 --strictPort",
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
```

- [ ] **Step 2: Create `tests/visual-parity.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const LEGACY = "http://localhost:4173";
const NEW = "http://localhost:5173";

const routes = [
  { name: "home", legacy: "/index.html", next: "/" },
  { name: "cal", legacy: "/cal.html", next: "/cal" },
];

const artifactsDir = path.join(process.cwd(), "tests", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifactsDir, { recursive: true });
});

for (const route of routes) {
  test(`${route.name}: screenshots legacy + new`, async ({ page }, testInfo) => {
    const viewport = testInfo.project.name;

    await page.goto(`${LEGACY}${route.legacy}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3500);
    const legacyShot = await page.screenshot({ fullPage: true });
    fs.writeFileSync(
      path.join(artifactsDir, `${route.name}-${viewport}-legacy.png`),
      legacyShot,
    );

    await page.goto(`${NEW}${route.next}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3500);
    const newShot = await page.screenshot({ fullPage: true });
    fs.writeFileSync(
      path.join(artifactsDir, `${route.name}-${viewport}-new.png`),
      newShot,
    );

    expect(legacyShot.byteLength).toBeGreaterThan(1000);
    expect(newShot.byteLength).toBeGreaterThan(1000);
  });
}

test("home: scroll arrow appears after 2.5s and hides on scroll", async ({ page }) => {
  await page.goto(`${NEW}/`);
  await page.waitForLoadState("networkidle");
  const arrow = page.locator("[data-testid='scroll-arrow']");
  await expect(arrow).toHaveCSS("opacity", "0");
  await page.waitForTimeout(2700);
  const opacity = await arrow.evaluate((el) => getComputedStyle(el).opacity);
  expect(parseFloat(opacity)).toBeGreaterThan(0.5);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(600);
  await expect(arrow).toHaveCSS("opacity", "0");
});

test("home: clicking email copies to clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${NEW}/`);
  await page.waitForLoadState("networkidle");
  await page.locator("[data-testid='copy-email']").click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe("njdweis@gmail.com");
});

test("cal: has noindex meta tag and iframe", async ({ page }) => {
  await page.goto(`${NEW}/cal`);
  await page.waitForLoadState("networkidle");
  const meta = page.locator('meta[name="robots"]');
  await expect(meta).toHaveAttribute("content", /noindex/);
  await expect(page.locator("iframe")).toBeVisible();
});
```

- [ ] **Step 3: Add scripts to `package.json`**

Open `package.json`, inside `"scripts"` replace/ensure:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "playwright test",
  "test:baseline": "playwright test --project=desktop --grep 'screenshots'",
  "serve:legacy": "serve legacy -p 4173 -L"
}
```

- [ ] **Step 4: Capture baselines against legacy only**

We can't run the full suite yet (no React app). Instead, spin up just the legacy server and capture screenshots manually.

```bash
npx serve legacy -p 4173 -L &
SERVER_PID=$!
sleep 2
```

Create a throwaway script file `tests/capture-legacy.mjs`:

```js
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const LEGACY = "http://localhost:4173";
const routes = [
  { name: "home", url: "/index.html" },
  { name: "cal", url: "/cal.html" },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const outDir = path.join(process.cwd(), "tests", "artifacts", "baseline");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  for (const r of routes) {
    await page.goto(`${LEGACY}${r.url}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3500);
    const shot = await page.screenshot({ fullPage: true });
    fs.writeFileSync(path.join(outDir, `${r.name}-${vp.name}.png`), shot);
    console.log(`captured ${r.name}-${vp.name}`);
  }
  await ctx.close();
}
await browser.close();
```

Run:
```bash
node tests/capture-legacy.mjs
kill $SERVER_PID
```

Expected: 6 PNG files written to `tests/artifacts/baseline/`.

- [ ] **Step 5: Verify baseline artifacts exist**

Run: `ls tests/artifacts/baseline/`
Expected: `home-desktop.png`, `home-tablet.png`, `home-mobile.png`, `cal-desktop.png`, `cal-tablet.png`, `cal-mobile.png`.

- [ ] **Step 6: Delete the throwaway capture script**

```bash
rm tests/capture-legacy.mjs
```

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts tests/visual-parity.spec.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
test: add Playwright config and visual-parity spec

Captures legacy + new screenshots at 3 breakpoints and validates
scroll-arrow, email-copy, and cal noindex behaviors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Build `Landing` component

**Files:**
- Create: `src/components/Landing/Landing.tsx`, `src/components/Landing/Landing.module.css`

- [ ] **Step 1: Create `src/components/Landing/Landing.module.css`**

```css
.landing {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}

.image {
  width: 20%;
  margin: 12px 0 37px 0;
  border-radius: 16px;
  filter: grayscale(100%);
  align-self: flex-end;
}

.name {
  font-size: 3rem;
  margin: 0 0 20px 0;
  border-bottom: 1px solid var(--text-color);
  width: 100%;
  padding-bottom: 10px;
  opacity: 0.7;
  color: var(--red-color);
  font-weight: bold;
}

.description {
  margin: 0 0 20px 0;
  width: 100%;
  max-width: 500px;
}

.socials {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.icon {
  width: 4.5rem;
  height: 2.5rem;
  object-fit: contain;
  transition: transform 0.3s ease;
}

.icon:hover {
  transform: scale(1.1);
}

.resumeButton {
  background-color: transparent;
  border: 2px solid var(--text-color);
  color: var(--text-color);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.resumeButton:hover {
  background-color: var(--text-color);
  color: var(--background-color);
}

@media screen and (orientation: portrait) {
  .image { width: 40%; }
}

@media screen and (max-width: 768px) {
  .image { width: 40%; }
  .name { font-size: 8vw; }
}
```

- [ ] **Step 2: Create `src/components/Landing/Landing.tsx`**

```tsx
import styles from "./Landing.module.css";

export function Landing() {
  return (
    <div className={styles.landing}>
      <img
        src="/assets/img/qhw25_edit.jpg"
        alt="Noah Weis"
        className={styles.image}
      />
      <h1 className={styles.name}>Noah Weis</h1>
      <p className={styles.description}>
        Software engineer with proven teamwork and leadership experience.
      </p>
      <div className={styles.socials}>
        <a
          href="https://www.linkedin.com/in/noahweis/"
          target="_blank"
          rel="noreferrer"
          title="LinkedIn"
        >
          <img src="/assets/img/linkedin.png" alt="LinkedIn" className={styles.icon} />
        </a>
        <a
          href="https://github.com/noahweis"
          target="_blank"
          rel="noreferrer"
          title="GitHub"
        >
          <img src="/assets/img/github.png" alt="GitHub" className={styles.icon} />
        </a>
        <a
          href="/assets/pdf/resume.pdf"
          target="_blank"
          rel="noreferrer"
        >
          <button className={styles.resumeButton}>Resume</button>
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Landing
git commit -m "$(cat <<'EOF'
feat: add Landing component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Build `ExperienceItem` component

**Files:**
- Create: `src/components/ExperienceItem/ExperienceItem.tsx`, `src/components/ExperienceItem/ExperienceItem.module.css`

- [ ] **Step 1: Create `src/components/ExperienceItem/ExperienceItem.module.css`**

```css
.item {
  margin-bottom: 3rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
  width: 100%;
}

.company {
  font-size: 1.5rem;
  color: var(--text-color);
  margin-bottom: 0.25rem;
}

.date {
  font-size: 1.2rem;
  color: var(--text-color);
}

.title {
  margin: 0;
  font-size: 2rem;
  color: var(--link-color);
  font-weight: bold;
}

.title a {
  color: inherit;
}

.content {
  display: flex;
  align-items: flex-start;
  gap: 2rem;
  margin-top: 1rem;
  justify-content: space-between;
}

.text {
  flex: 1;
}

.role {
  font-size: 1.2rem;
  font-style: italic;
  color: var(--text-color);
  margin-bottom: 0.5rem;
}

.bullets {
  padding-left: 1.5rem;
  list-style-position: outside;
  margin: 0;
}

.bullets li {
  margin-bottom: 10px;
  max-width: 90%;
  font-size: 1.2rem;
  text-align: left;
}

.skills {
  font-size: 1.2rem;
  margin-top: 1rem;
  color: var(--text-color);
  opacity: 0.8;
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.skillEntry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.skillIcon {
  height: 2em;
  width: auto;
}

.image {
  width: 40%;
  border-radius: 16px;
  margin-left: auto;
}

@media screen and (max-width: 768px) {
  .content {
    flex-direction: column;
  }
  .image {
    width: 100%;
    margin: 1.5rem 0 0 0;
  }
  .bullets {
    padding-left: 1rem;
  }
  .bullets li {
    padding-left: 1rem;
    max-width: 100%;
    font-size: 6vw;
  }
  .title {
    font-size: 8vw;
  }
}
```

- [ ] **Step 2: Create `src/components/ExperienceItem/ExperienceItem.tsx`**

```tsx
import type { Experience } from "../../types";
import styles from "./ExperienceItem.module.css";

interface Props {
  experience: Experience;
}

export function ExperienceItem({ experience }: Props) {
  const { company, date, title, link, role, bullets, skills, image } = experience;

  return (
    <div className={styles.item}>
      <div className={styles.header}>
        <div className={styles.company}>{company}</div>
        <span className={styles.date}>{date}</span>
      </div>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {link ? (
            <a href={link} target="_blank" rel="noreferrer">
              {title}
            </a>
          ) : (
            <a href="/education">{title}</a>
          )}
        </h2>
      </div>
      <div className={styles.content}>
        <div className={styles.text}>
          <div className={styles.role}>{role}</div>
          <ul className={styles.bullets}>
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className={styles.skills}>
            {typeof skills === "string"
              ? skills
              : skills.map((s) => (
                  <span key={s.label} className={styles.skillEntry}>
                    {s.icon && (
                      <img src={s.icon} alt={s.label} className={styles.skillIcon} />
                    )}
                    {s.label}
                  </span>
                ))}
          </div>
        </div>
        <img src={image.src} alt={image.alt} className={styles.image} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExperienceItem
git commit -m "$(cat <<'EOF'
feat: add ExperienceItem component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Build `ExperiencesSection` component

**Files:**
- Create: `src/components/ExperiencesSection/ExperiencesSection.tsx`, `src/components/ExperiencesSection/ExperiencesSection.module.css`

- [ ] **Step 1: Create `src/components/ExperiencesSection/ExperiencesSection.module.css`**

```css
.section {
  margin: var(--section-spacing) 0 0 0;
  padding-bottom: 4rem;
  width: 100%;
}

.heading {
  font-size: 3rem;
  text-align: left;
  margin: 0 0 20px 0;
  border-bottom: 1px solid var(--text-color);
  width: 100%;
  padding-bottom: 10px;
  opacity: 0.7;
  color: var(--red-color);
  font-weight: bold;
}

@media screen and (max-width: 768px) {
  .heading { font-size: 8vw; }
}
```

- [ ] **Step 2: Create `src/components/ExperiencesSection/ExperiencesSection.tsx`**

```tsx
import { ExperienceItem } from "../ExperienceItem/ExperienceItem";
import { experiences } from "../../data/experiences";
import styles from "./ExperiencesSection.module.css";

export function ExperiencesSection() {
  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Work</h1>
      {experiences.map((exp) => (
        <ExperienceItem key={exp.company} experience={exp} />
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExperiencesSection
git commit -m "$(cat <<'EOF'
feat: add ExperiencesSection component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Build `ContactSection` component

**Files:**
- Create: `src/components/ContactSection/ContactSection.tsx`, `src/components/ContactSection/ContactSection.module.css`

- [ ] **Step 1: Create `src/components/ContactSection/ContactSection.module.css`**

```css
.section {
  margin: var(--section-spacing) 0 0 0;
  padding-bottom: 4rem;
  width: 100%;
}

.heading {
  font-size: 3rem;
  text-align: left;
  margin: 0 0 20px 0;
  border-bottom: 1px solid var(--text-color);
  width: 100%;
  padding-bottom: 10px;
  opacity: 0.7;
  color: var(--red-color);
  font-weight: bold;
}

.entry {
  font-size: 2.5rem;
  margin-bottom: 20px;
  color: var(--link-color);
  font-weight: bold;
}

.entry a {
  color: inherit;
}

.copyable {
  cursor: pointer;
}

.toast {
  margin-left: 0.5rem;
  font-size: 1.2rem;
  color: var(--red-color);
  opacity: 0.9;
}

@media screen and (max-width: 768px) {
  .heading { font-size: 8vw; }
  .entry { font-size: 8vw; }
}
```

- [ ] **Step 2: Create `src/components/ContactSection/ContactSection.tsx`**

```tsx
import { useState } from "react";
import styles from "./ContactSection.module.css";

export function ContactSection() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    await navigator.clipboard.writeText("njdweis@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Contact</h1>
      <h2
        className={`${styles.entry} ${styles.copyable}`}
        onClick={copyEmail}
        data-testid="copy-email"
      >
        <a>Click to copy email</a>
        {copied && <span className={styles.toast}>Copied!</span>}
      </h2>
      <h2 className={styles.entry}>
        <a
          href="https://www.linkedin.com/in/noahweis/"
          target="_blank"
          rel="noreferrer"
        >
          Connect on LinkedIn
        </a>
      </h2>
      <h2 className={styles.entry}>
        <a href="https://quackhacks.org/" target="_blank" rel="noreferrer">
          QuackHacks Sponsor?
        </a>
      </h2>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ContactSection
git commit -m "$(cat <<'EOF'
feat: add ContactSection component with clipboard toast

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Build `ScrollArrow` component

**Files:**
- Create: `src/components/ScrollArrow/ScrollArrow.tsx`, `src/components/ScrollArrow/ScrollArrow.module.css`

- [ ] **Step 1: Create `src/components/ScrollArrow/ScrollArrow.module.css`**

```css
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translate(-50%, 0); }
  40% { transform: translate(-50%, -20px); }
  60% { transform: translate(-50%, -10px); }
}

.arrow {
  font-size: 2rem;
  color: var(--text-color);
  animation: bounce 2s infinite;
  cursor: pointer;
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  transition: opacity 0.5s ease;
  opacity: 0;
}

.visible {
  opacity: 0.7;
}
```

- [ ] **Step 2: Create `src/components/ScrollArrow/ScrollArrow.tsx`**

```tsx
import { useEffect, useState } from "react";
import styles from "./ScrollArrow.module.css";

export function ScrollArrow() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 2500);
    const onScroll = () => setVisible(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(showTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      className={`${styles.arrow} ${visible ? styles.visible : ""}`}
      data-testid="scroll-arrow"
    >
      ↓
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ScrollArrow
git commit -m "$(cat <<'EOF'
feat: add ScrollArrow component with delayed appearance

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Build `Home` route

**Files:**
- Create: `src/routes/Home.tsx`, `src/routes/Home.module.css`

- [ ] **Step 1: Create `src/routes/Home.module.css`**

```css
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-top: var(--top-spacing);
  justify-content: space-between;
}

.container {
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}
```

- [ ] **Step 2: Create `src/routes/Home.tsx`**

```tsx
import { Landing } from "../components/Landing/Landing";
import { ExperiencesSection } from "../components/ExperiencesSection/ExperiencesSection";
import { ContactSection } from "../components/ContactSection/ContactSection";
import { ScrollArrow } from "../components/ScrollArrow/ScrollArrow";
import styles from "./Home.module.css";

export function Home() {
  return (
    <>
      <main className={`${styles.page} fade-in-text`}>
        <div className={styles.container}>
          <Landing />
        </div>
        <div className={styles.container}>
          <ExperiencesSection />
          <ContactSection />
        </div>
      </main>
      <ScrollArrow />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/Home.tsx src/routes/Home.module.css
git commit -m "$(cat <<'EOF'
feat: compose Home route with full-viewport landing layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Build `Cal` route

**Files:**
- Create: `src/routes/Cal.tsx`, `src/routes/Cal.module.css`

- [ ] **Step 1: Create `src/routes/Cal.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
  padding-top: 40px;
  padding-bottom: 150px;
}

.heading {
  font-size: 3rem;
  text-align: left;
  margin: 0 0 20px 0;
  border-bottom: 1px solid var(--text-color);
  width: 100%;
  padding-bottom: 10px;
  opacity: 0.7;
  color: var(--red-color);
  font-weight: bold;
}

.heading a {
  color: inherit;
  text-decoration: none;
}

.description {
  margin: 0 0 20px 0;
  width: 90%;
}

.iframe {
  border: 0;
  width: 100%;
  min-height: 600px;
}

.footer {
  margin-top: 30px;
  width: 100%;
  display: flex;
  justify-content: space-between;
}

.footer a {
  color: inherit;
  font-weight: normal;
}

@media screen and (max-width: 768px) {
  .heading { font-size: 8vw; }
}
```

- [ ] **Step 2: Create `src/routes/Cal.tsx`**

```tsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Cal.module.css";

const CAL_SRC =
  "https://calendar.google.com/calendar/embed?src=a0ccadea8432cefa326b59168dc6a9607969783f7a1dd492cf8737170f2b479f%40group.calendar.google.com&src=51d1dfca34125b7a3d5dffa77f9e54f7a0222dd5b3b2481279cad17efa46d9bd%40group.calendar.google.com&src=njdweis%40gmail.com&src=08f4a1f7d8e33a9d38937ce85c537f6d79afc3e7e62d93510d9ad3f300a8781b%40group.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK";

export function Cal() {
  useEffect(() => {
    document.title = "Calendar | Noah Weis | QuackHacks";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
      document.title = "Noah Weis | Home";
    };
  }, []);

  return (
    <main className={`${styles.page} fade-in-text`}>
      <h1 className={styles.heading}>
        <Link to="/">My Availability</Link>
      </h1>
      <p className={styles.description}>
        Below is my free/busy schedule for the week. Times are shown in Pacific
        Time.
      </p>
      <iframe
        src={CAL_SRC}
        className={styles.iframe}
        frameBorder="0"
        scrolling="no"
        title="Google Calendar availability"
      />
      <p className={styles.footer}>
        <Link to="/">&larr; Back to home</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/Cal.tsx src/routes/Cal.module.css
git commit -m "$(cat <<'EOF'
feat: add Cal route with noindex meta tag

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Wire up router in `App.tsx` and `main.tsx`

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`, `index.html`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Replace `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Replace root `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <title>Noah Weis | Home</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Run the dev server**

Run: `npm run dev`
Expected: Vite dev server starts on http://localhost:5173. No compile errors.

Open http://localhost:5173/ in a browser. Visually confirm:
- Headshot image loads
- Name, tagline, social icons, resume button all appear
- Scrolling down reveals Work section with all 4 experiences
- Contact section at bottom
- Scroll arrow appears after ~2.5s

Open http://localhost:5173/cal
- Calendar iframe renders
- "My Availability" heading, description, back link

Stop server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx index.html
git commit -m "$(cat <<'EOF'
feat: wire up react-router with Home and Cal routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Run Playwright parity suite and review

**Files:**
- Artifacts only: `tests/artifacts/*.png`

- [ ] **Step 1: Run Playwright**

Run: `npm test`

Playwright starts both servers (legacy on :4173, new on :5173) and runs the suite.

Expected: screenshots are captured to `tests/artifacts/` for all 3 breakpoints × 2 routes. Interaction tests pass (scroll arrow, email copy, cal noindex).

- [ ] **Step 2: Visual review**

Open `tests/artifacts/` in a file browser. For each pair:
- `home-desktop-legacy.png` vs `home-desktop-new.png`
- `home-tablet-legacy.png` vs `home-tablet-new.png`
- `home-mobile-legacy.png` vs `home-mobile-new.png`
- `cal-desktop-legacy.png` vs `cal-desktop-new.png`
- `cal-tablet-legacy.png` vs `cal-tablet-new.png`
- `cal-mobile-legacy.png` vs `cal-mobile-new.png`

Compare side-by-side. Expected differences (acceptable):
- Landing section: JS-computed `marginTop` vs CSS `justify-content: space-between` may shift the Work section slightly.
- Contact section: new version has a "Copied!" toast that only appears on click (not in screenshots).

Unacceptable differences to fix:
- Fonts rendering differently.
- Colors not matching.
- Icons or images missing / wrong aspect.
- Layout order changed.
- Skills row wrapping differently.
- Mobile breakpoints behaving differently.

- [ ] **Step 3: Fix any flagged regressions**

For each issue found, open the relevant CSS Module and adjust. After each fix, re-run:
```bash
npm test
```

Iterate until all diffs are either acceptable or resolved.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: resolve visual parity drift flagged by Playwright

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(Skip this commit if no fixes were needed.)

---

### Task 18: Add `.htaccess` and `robots.txt`

**Files:**
- Create: `public/.htaccess`, `public/robots.txt`

- [ ] **Step 1: Create `public/.htaccess`**

```apache
# SPA fallback: route all non-file requests to index.html
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# Permanent redirect for legacy URL
Redirect 301 /cal.html /cal
```

- [ ] **Step 2: Create `public/robots.txt`**

```
User-agent: *
Disallow: /cal
```

- [ ] **Step 3: Verify build includes them**

Run: `npm run build`
Run: `ls dist/`
Expected: `dist/` contains `.htaccess` and `robots.txt` (Vite copies `public/*` verbatim).

Run: `rm -rf dist`

- [ ] **Step 4: Commit**

```bash
git add public/.htaccess public/robots.txt
git commit -m "$(cat <<'EOF'
feat: add .htaccess SPA rewrite and robots.txt

.htaccess: SPA fallback + 301 from /cal.html to /cal
robots.txt: Disallow /cal (unlisted calendar page)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Add GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build

      - name: Configure SSH
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_HOST: ${{ secrets.SSH_HOST }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "$SSH_HOST" >> ~/.ssh/known_hosts

      - name: Deploy via rsync
        env:
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
          WEBROOT_PATH: ${{ secrets.WEBROOT_PATH }}
        run: |
          rsync -az --delete -e "ssh -i ~/.ssh/id_ed25519" \
            dist/ "$SSH_USER@$SSH_HOST:$WEBROOT_PATH/"
```

- [ ] **Step 2: Document required secrets**

Create `.github/DEPLOYMENT.md`:

```markdown
# Deployment

Production deploys run via `.github/workflows/deploy.yml` on push to `main`.

## Required repository secrets

Settings → Secrets and variables → Actions:

- `SSH_PRIVATE_KEY` — private key (ed25519 recommended) whose public key is in `~/.ssh/authorized_keys` on DreamHost.
- `SSH_HOST` — DreamHost hostname (e.g. `noahweis.dev` or the server hostname).
- `SSH_USER` — SSH user on DreamHost.
- `WEBROOT_PATH` — absolute path to the public web root (e.g. `/home/username/noahweis.dev`).

## Manual deploy

Actions tab → Deploy → Run workflow.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml .github/DEPLOYMENT.md
git commit -m "$(cat <<'EOF'
ci: add GitHub Actions workflow to rsync dist/ to DreamHost

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Generate SSH deploy key and install on DreamHost

**Files:**
- Create (local, outside repo): `~/.ssh/noahweis_deploy`, `~/.ssh/noahweis_deploy.pub`
- Modify (remote): `~/.ssh/authorized_keys` on DreamHost

> **Credentials note:** The DreamHost hostname, SSH username, and one-time password needed here are NOT written in this plan. Pull them from the chat/password manager. After key-based auth is working, rotate the DreamHost password via the panel so the one shared in chat is no longer valid.

- [ ] **Step 1: Generate a dedicated keypair**

```bash
ssh-keygen -t ed25519 -f "$HOME/.ssh/noahweis_deploy" -N "" -C "noahweis-deploy"
```
Expected: `~/.ssh/noahweis_deploy` (private) and `~/.ssh/noahweis_deploy.pub` (public).

- [ ] **Step 2: Install the public key on DreamHost**

Print the public key:
```bash
cat "$HOME/.ssh/noahweis_deploy.pub"
```

SSH to DreamHost using password auth (one time). Use `<SSH_USER>@<SSH_HOST>` and the password from chat / password manager:
```bash
ssh <SSH_USER>@<SSH_HOST>
```

Once connected, append the public key to authorized_keys with correct permissions:
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
printf '%s\n' '<paste contents of noahweis_deploy.pub here>' >> ~/.ssh/authorized_keys
exit
```

- [ ] **Step 3: Verify key-based auth works**

```bash
ssh -i "$HOME/.ssh/noahweis_deploy" -o PasswordAuthentication=no \
    <SSH_USER>@<SSH_HOST> "echo key-auth-ok && pwd"
```
Expected: `key-auth-ok` followed by the remote home path. No password prompt.

- [ ] **Step 4: Find the webroot path**

```bash
ssh -i "$HOME/.ssh/noahweis_deploy" <SSH_USER>@<SSH_HOST> "ls ~"
```
Expected: a directory matching the site domain. Note its absolute path (e.g. `/home/<SSH_USER>/<domain-dir>`) — needed for the `WEBROOT_PATH` GitHub secret.

- [ ] **Step 5: Configure GitHub repo secrets**

GitHub → repo → Settings → Secrets and variables → Actions → New repository secret. Add:

| Secret name | Value source |
|---|---|
| `SSH_PRIVATE_KEY` | entire contents of `~/.ssh/noahweis_deploy` (including `-----BEGIN/END-----` lines) |
| `SSH_HOST` | from chat / password manager |
| `SSH_USER` | from chat / password manager |
| `WEBROOT_PATH` | absolute path from Step 4 |

Confirm with (optional, requires `gh` CLI): `gh secret list` — expect all four names to appear.

- [ ] **Step 6: Trigger a deploy and verify**

```bash
git push origin main
```

Watch the Actions tab for the `Deploy` workflow. On success, browse to the live site and confirm the new React build is serving.

- [ ] **Step 7: Rotate the DreamHost password**

After key auth is confirmed working, log in to the DreamHost panel (Users → SFTP/SSH) and reset the password so the one shared in chat is invalidated. No code or workflow change is needed — CI and the local helper both use the key.

---

### Task 21: Create local SSH helper script (gitignored)

**Files:**
- Modify: `.gitignore`
- Create: `scripts/ssh.sh` (gitignored; contains host-specific values)

- [ ] **Step 1: Gitignore the scripts directory**

Append to `.gitignore`:

```gitignore

# Local-only helper scripts (contain host-specific values)
/scripts/
```

- [ ] **Step 2: Create `scripts/ssh.sh`**

```bash
mkdir -p scripts
```

Create `scripts/ssh.sh`. Fill in the `<SSH_HOST>` and `<SSH_USER>` placeholders from your credentials source:

```bash
#!/usr/bin/env bash
set -eu

SSH_HOST="<SSH_HOST>"
SSH_USER="<SSH_USER>"
SSH_PORT=22
SSH_KEY="$HOME/.ssh/noahweis_deploy"

echo "Clearing hanging SSH sessions to ${SSH_HOST}..."

# 1. Release any ControlMaster sockets (no-op if none exist)
ssh -O exit -o ControlPath="$HOME/.ssh/cm-%r@%h:%p" \
    "$SSH_USER@$SSH_HOST" 2>/dev/null || true

# 2. Kill lingering ssh client processes targeting this host
if command -v pkill >/dev/null 2>&1; then
    pkill -f "ssh.*${SSH_HOST}" 2>/dev/null || true
else
    ps -ef 2>/dev/null \
        | grep -E "ssh.*${SSH_HOST}" \
        | grep -v grep \
        | awk '{print $2}' \
        | xargs -r kill 2>/dev/null || true
fi

# 3. Connect (key-only, password auth disabled)
exec ssh \
    -i "$SSH_KEY" \
    -p "$SSH_PORT" \
    -o PasswordAuthentication=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    "$SSH_USER@$SSH_HOST" "$@"
```

- [ ] **Step 3: Make it executable**

```bash
chmod +x scripts/ssh.sh
```

- [ ] **Step 4: Test the script**

```bash
./scripts/ssh.sh "echo connected && hostname && exit"
```
Expected: prints `Clearing hanging SSH sessions...` then `connected` and the DreamHost hostname. No password prompt.

- [ ] **Step 5: Verify the script is NOT tracked**

```bash
git status --short
```
Expected: only `.gitignore` shows as modified. `scripts/ssh.sh` must not appear.

- [ ] **Step 6: Commit the .gitignore change**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: gitignore /scripts/ for local-only SSH helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Final parity sweep

**Files:**
- No code changes expected; this is a verification task.

- [ ] **Step 1: Rebuild and re-run tests**

```bash
rm -rf dist
npm run build
```
Expected: build succeeds, no TypeScript errors.

Run: `npm test`
Expected: all Playwright tests pass.

- [ ] **Step 2: Manual smoke test against the built output**

Run: `npx serve dist -p 4000 -L &`
Open http://localhost:4000/ — confirm home loads and looks correct.
Open http://localhost:4000/cal — confirm cal loads.
Kill the server.

- [ ] **Step 3: Final side-by-side review**

Spot-check the 6 screenshot pairs in `tests/artifacts/` one last time. No fixes needed if everything matches.

---

### Task 23: Remove `legacy/` folder

**Files:**
- Delete: `legacy/`
- Modify: `playwright.config.ts`, `tests/visual-parity.spec.ts`, `package.json`

- [ ] **Step 1: Confirm parity is approved**

DO NOT proceed until the user has reviewed the parity artifacts and confirmed that the new site looks acceptably close to the legacy version.

- [ ] **Step 2: Remove legacy folder**

```bash
git rm -r legacy
```

- [ ] **Step 3: Remove legacy-dependent test code**

Edit `playwright.config.ts`: delete the `legacy` entry from the `webServer` array (keep only the `npm run dev` entry).

Edit `tests/visual-parity.spec.ts`: delete the `LEGACY`-related screenshot comparisons (the first `for (const route of routes)` test block). Keep only the interaction tests (scroll arrow, email copy, cal noindex).

Edit `package.json`: remove the `serve:legacy` script. Also remove `serve` from `devDependencies`:
```bash
npm uninstall serve
```

- [ ] **Step 4: Verify tests still pass**

Run: `npm test`
Expected: interaction tests pass. Legacy comparisons no longer run.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: remove legacy/ baseline after parity approval

React/TS version verified against legacy site via Playwright at
3 breakpoints on both routes. Legacy no longer needed; keeping only
behavioral interaction tests in the suite.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done

At this point:
- Site runs on Vite + React + TS with CSS Modules.
- `/` and `/cal` routes work locally and produce the correct static output under `dist/`.
- `/cal` is noindex + disallowed in `robots.txt`.
- Playwright interaction tests guard the scroll arrow, email copy, and cal noindex behaviors.
- Pushing to `main` triggers a build + rsync deploy to DreamHost.
- `legacy/` is gone; commit history preserves it if ever needed.
