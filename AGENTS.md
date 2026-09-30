# Agent instructions — Kirana POS

Generated from the skills in the `kirana-skill` repo. Do not edit directly; run
`./export.sh` instead.

Two git repos, one product: `kirana-ui` (Ionic POS) and `kirana-server` (Express API).
Not microservices. **Jira project KIR is the source of truth.** Developer work runs
through Compound Engineering `lfg`. Default integration branch is `dev`.

## Before starting anything

```bash
kirana-skill/kirana-start/scripts/preflight.sh
```

## kirana-start

**When to use:** Start Kirana POS development from a Jira issue and take it through the Compound Engineering workflow to a reviewed pull request. Use when someone says kirana-start, asks what to work on, names a KIR issue, or wants the Jira-to-PR demo. This is the Developer lane; it does not replace QA or product-management workflows.

The entry point for Kirana work.

**Jira project KIR is the source of truth.** Not the code, chat, or GitHub Issues. If work has no Jira issue, draft one and get confirmation before creating it.

Two repos, one product: `kirana-ui` (POS) and `kirana-server` (API). Not microservices.

### Step 1 — preflight

```bash
kirana-skill/kirana-start/scripts/preflight.sh
```

Failures stop the run. Use `/kirana-config`, then rerun preflight. Compound Engineering and authenticated Jira/GitHub access are required for the demo; MySQL is required only when the selected work needs the local API.

### Step 2 — establish the lane and pick the issue

Ask who is working. The supported demo lane is **Developer**. If they choose another role, explain that its lane is not configured rather than pretending to run it.

List the current sprint and the developer's assigned issues:

```bash
kirana-skill/kirana-start/scripts/jira.sh sprint
kirana-skill/kirana-start/scripts/jira.sh mine
kirana-skill/kirana-start/scripts/jira.sh list
```

If they name a key, read it with `jira.sh issue KIR-N` and treat its description and acceptance criteria as the contract.

Do not silently create, transition, assign, or comment on Jira. The helper previews writes and requires `--confirm` after the user approves the exact preview. For new work, preview `jira.sh create Task|Bug "title" "description"`; after approval, rerun with `--confirm`.

Start the selected issue by previewing `jira.sh start KIR-N`; after approval, rerun it with `--confirm`.

### Step 3 — choose the repo and branch

| Change lives in | Repo |
| --- | --- |
| Screen, RTK slice, Ionic, Capacitor | `kirana-ui` |
| Route, Prisma, JWT, tenant, import | `kirana-server` |
| API contract | usually **both** — server first, then UI |

Default base branch is `dev`. Create:

```bash
kirana-skill/kirana-start/scripts/branch.sh <ui|server> <KIR-key> <short-slug>
```

Do not create a branch on a dirty tree without parking or committing (ask them).

### Step 4 — run Compound Engineering

State this clearly in the demo: **"Kirana orchestration is now handing the Jira issue to Compound Engineering."** Then invoke the installed `lfg` skill with an issue packet containing:

- Jira key, URL, type, description, and acceptance criteria;
- selected repo and the current feature branch;
- `dev` as the PR base;
- a requirement to link the Jira URL in the PR;
- a requirement to stop at an open PR and never merge without explicit permission.

`lfg` is the orchestrator. It visibly routes through the applicable CE stages: planning or debugging, `ce-work`, simplification, `ce-code-review`, browser testing when relevant, `ce-commit-push-pr`, and CI watching. Do not replace this with an ordinary chat implementation. If `lfg` or a required CE child skill is unavailable, stop and repair the plugin with `/kirana-config`.

Read `kirana-context/` before changing tenant, ledger, invoice, or barcode behaviour.

Read `kirana-skill/kirana-start/reference/dev.md` for the definition of done.

### Step 5 — PR, merge, and Jira close-out

The CE run ends with an open PR into `dev`; it does not merge. Present the PR URL and test/CI evidence. Merge only when the user explicitly asks for that PR to be merged.

`finish.sh` is a recovery path if CE completed the code but could not ship:

```bash
kirana-skill/kirana-start/scripts/finish.sh <ui|server>
```

It pushes the current branch and opens a PR **into `dev`**. Do not run it if `lfg` already created the PR.

After the PR is actually merged, preview `jira.sh done KIR-N <PR-URL>` and, after approval, rerun with `--confirm`. Never mark Jira Done merely because a PR exists.

### Demo narration

Show these checkpoints rather than hiding the orchestration:

1. Free Jira sprint and selected KIR issue.
2. Repo and `KIR-N-slug` branch from `dev`.
3. Compound Engineering route selected by `lfg`.
4. Local verification and CE code-review result.
5. Open GitHub PR into `dev` and CI result.
6. Explicit merge decision, followed by Jira Done.

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
kirana-skill/kirana-config/scripts/setup.sh --auth
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
- Cursor Compound Engineering plugin (required for the Developer demo)
- Jira Cloud API token for the personal `shahrajesh2113@yahoo.com` account

`setup.sh --auth` stores Jira settings with mode `0600` in `~/.config/kirana-start/env`. Never commit or paste that file into chat. Creating or revoking the Atlassian token remains a user-approved account action.

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
| `kirana-skill/kirana-start/scripts/` | `preflight.sh`, `jira.sh`, `branch.sh`, `finish.sh` |
| `kirana-skill/kirana-platform/recipes/` | Trace a request; add a column |
| `kirana-context/` | Product knowledge |
