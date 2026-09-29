# Agent instructions — Kirana POS

Generated from the skills in the `kirana-skill` repo. Do not edit directly; run
`./export.sh` instead.

Two git repos, one product: `kirana-ui` (Ionic POS) and `kirana-server` (Express API).
Not microservices. **GitHub Issues are the source of truth.** Default integration
branch is `dev`.

## Before starting anything

```bash
kirana-skill/kirana-start/scripts/preflight.sh
```

## kirana-start

**When to use:** Start work on Kirana POS. Run at the beginning of a session to pick up a GitHub issue, scope a new one, or ship a PR. Validates the environment first, then routes to the right Compound Engineering workflow and holds the work to the GitHub issue as the source of truth. Use when someone says kirana-start, "what should I work on", "pick up issue N", or is beginning Kirana work of any kind.

The entry point for Kirana work.

**GitHub Issues are the source of truth.** Not the code, not the chat. If the work is not an issue, help them open one first.

Two repos, one product: `kirana-ui` (POS) and `kirana-server` (API). Not microservices.

### Step 1 — preflight

```bash
kirana-skill/kirana-start/scripts/preflight.sh
```

Failures: stop and offer `/kirana-config`. Warnings (MySQL not running, CE plugin missing) are not blockers unless this session needs them.

### Step 2 — pick the issue

List open issues (both repos):

```bash
kirana-skill/kirana-start/scripts/gh-issue.sh mine
kirana-skill/kirana-start/scripts/gh-issue.sh list
```

If they name a number, `gh-issue.sh show <repo> <n>` (repo is `ui` or `server`).

If they need a new issue: draft title + body, **create nothing until they confirm**, then:

```bash
kirana-skill/kirana-start/scripts/gh-issue.sh create ui|server "<title>" "<body>"
```

Put the issue in **In progress** with a comment that work started (Projects optional; a comment is enough).

### Step 3 — choose the repo and branch

| Change lives in | Repo |
| --- | --- |
| Screen, RTK slice, Ionic, Capacitor | `kirana-ui` |
| Route, Prisma, JWT, tenant, import | `kirana-server` |
| API contract | usually **both** — server first, then UI |

Default base branch is `dev`. Create:

```bash
kirana-skill/kirana-start/scripts/branch.sh <ui|server> <issue-number> <short-slug>
```

Do not create a branch on a dirty tree without parking or committing (ask them).

### Step 4 — route the work

Use Compound Engineering if the plugin is installed; otherwise do the same work in this chat.

| Kind | Skill |
| --- | --- |
| Bug / wrong behaviour | `ce-debug`, then `ce-work` |
| Known build | `ce-work` |
| Vague idea | `ce-brainstorm` then `ce-plan` |
| Plan already written | `ce-work` |
| Done coding, ship | commit (when they ask) then `branch.sh` is already done; `finish.sh` |

Read `kirana-context/` before changing tenant, ledger, invoice, or barcode behaviour.

Read `kirana-skill/kirana-start/reference/dev.md` for the definition of done.

### Step 5 — finish

When they want a PR:

```bash
kirana-skill/kirana-start/scripts/finish.sh <ui|server>
```

That pushes the current branch and opens a PR **into `dev`**. Do not push or open a PR unless they asked.

Link the GitHub issue in the PR body (`Fixes #N` if the issue is on the **same** repo).

## kirana-platform

**When to use:** Orientation for Kirana POS — two git repos, one Express API, one Ionic POS, MySQL tenants. Use when a question is about which repo to change, how a request reaches the database, what tenant_id means, or how invoices, inventory, or barcodes fit together. Also use before a change that spans UI and server.

Read `kirana-context/README.md` and `kirana-context/GLOSSARY.md` first.

### Which repo

| You are touching | Repo |
| --- | --- |
| Ionic page, RTK Query, Redux, Tailwind, Capacitor | `kirana-ui` |
| Express route, Prisma, Zod, JWT, file import | `kirana-server` |
| New field on an invoice/product/customer | Prisma in server, then types + form in UI |
| Shopper cart/order | server modules `cart` / `order` / `catalog` / `customer-auth`; UI is `kirana-ui-customer` if present |

There is no queue, no extra Node service, no separate “billing microservice”.

### How a POS request travels

1. UI `fetchBaseQuery` → `VITE_API_BASE_URL` + path (e.g. `/invoices`).
2. Express `app.use('/api/v1', routes)`.
3. Auth middleware reads Bearer JWT (`userId`, `tenantId`, roles).
4. `extractTenant` sets `req.tenantId`.
5. Service/repository filters by `tenant_id`.
6. Prisma → MySQL.

If the UI shows a 401 loop: refresh is `POST /auth/refresh-token`. Check tokens in `localStorage` (`access_token`, `refresh_token`).

If the UI talks to Railway instead of localhost: `VITE_API_BASE_URL` is unset and `constants` fall back to production.

### Recipes

- `kirana-platform/recipes/trace-a-request.md`
- `kirana-platform/recipes/add-a-column.md`

### Invariants

- Do not drop `tenant_id` from queries.
- Do not add a new HTTP service for a new screen.
- POS roles in the UI are OWNER / MANAGER / CASHIER.
- Sales vs purchases: `invoices` vs `purchase_invoices`.

## kirana-config

**When to use:** Set up or repair what kirana-start needs — Node, gh, sibling repos, Compound Engineering, Cursor install. Use when someone says kirana-config, cannot get preflight to pass, or is on a new machine.

Run the installer, then preflight.

```bash
kirana-skill/kirana-config/scripts/setup.sh
kirana-skill/install.sh --cursor --codex
kirana-skill/kirana-start/scripts/preflight.sh
```

### Expected siblings

Under the same parent as `kirana-skill`:

- `kirana-ui` (clone `git@github.com:iamrajshah/kirana-ui.git`)
- `kirana-server` (clone `git@github.com:iamrajshah/kirana-server.git`)
- `kirana-context`

### Tools

- Node 18+, npm, git, GitHub CLI (`gh auth login`)
- MySQL 8 if they will run the API locally
- Cursor Compound Engineering plugin (optional but useful)

### Editor

Open `kirana.code-workspace` (parent folder) so both apps, skill, and context are visible. New chat after install so rule text loads.

Do not write secrets into the skill repo. `.env` stays in each app, untracked.

## kirana-reload

**When to use:** Pull the latest kirana-skill and reinstall Cursor/Codex files. Use when someone says kirana-reload, asks to refresh the skills, or wonders whether they are on the latest version.

From a clean `kirana-skill` checkout on its main branch:

```bash
git -C kirana-skill pull --ff-only
kirana-skill/install.sh --cursor --codex
```

If the tree is dirty or you are on a skill feature branch, do not pull. Say so and leave it.

Cursor: new chat to pick up changed rule text. Codex: new session.

## kirana-update-context

**When to use:** Refresh kirana-context so the docs match the two app repos. Use when someone says kirana-update-context, a doc was wrong, or after a stretch of commits that changed behaviour.

1. `git -C kirana-ui log --oneline -20` and the same for `kirana-server`.
2. Read diffs that touch routes, Prisma, auth, or POS screens.
3. Update only the files in `kirana-context/` that drifted (`kirana-ui/README.md`, `kirana-server/README.md`, `GLOSSARY.md`).
4. Append a dated bullet to `PROVENANCE.md` with SHAs you used.
5. Do not copy whole source files into context. Short maps only.

This is documentation. Do not change `kirana-ui` or `kirana-server` from this skill.

## Files this refers to

Paths are relative to the parent folder that contains the four siblings.

| Path | What |
| --- | --- |
| `kirana-skill/kirana-start/reference/` | Dev lane |
| `kirana-skill/kirana-start/scripts/` | `preflight.sh`, `gh-issue.sh`, `branch.sh`, `finish.sh` |
| `kirana-skill/kirana-platform/recipes/` | Trace a request; add a column |
| `kirana-context/` | Product knowledge |
