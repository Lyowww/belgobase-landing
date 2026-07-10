# BelgoBase Landing

Marketing site for [BelgoBase](https://belgobase.com) — Belgian B2B company intelligence built on official KBO and NBB data. The site is bilingual (English / Dutch), supports light and dark themes, and can run either as a full landing page or a lightweight **coming soon** screen.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · Resend (contact form)

---

## Quick start

```bash
# Install dependencies
npm install

# Start the dev server (port 3001)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). The app redirects `/` to `/en` or `/nl` based on your browser language or the `NEXT_LOCALE` cookie.

```bash
npm run build   # Production build
npm run start   # Serve the production build
npm run lint    # ESLint
```

---

## Environment variables

Create a `.env.local` file in the project root (never commit this file):

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | For contact form | API key from [Resend](https://resend.com) |
| `ADMIN_EMAIL` | For contact form | Real mailbox that receives demo/contact notifications |
| `CONTACT_EMAIL` | Fallback | Used as recipient if `ADMIN_EMAIL` is unset |
| `RESEND_FROM_EMAIL` | Optional | Verified sender, defaults to `BelgoBase <noreply@belgobase.be>` |
| `NEXT_PUBLIC_SITE_URL` | Optional | Canonical site URL for SEO metadata (defaults to the value in `src/lib/site.ts`) |

Without `RESEND_API_KEY` and `ADMIN_EMAIL` (or `CONTACT_EMAIL`), the contact form returns an error. Do **not** set the recipient to `noreply@belgobase.be` — that address is send-only. Everything else works locally without env vars. See `.env.example`.

---

## Branch workflow: `dev` vs `main`

This repo uses two long-lived branches with different jobs.

| Branch | Purpose | What visitors see | Typical domain |
|--------|---------|---------------------|----------------|
| **`main`** | **Production** — what the public sees | Coming soon page (`comingSoonEnabled = true`) | `belgobase.com` |
| **`dev`** | **Development / staging** — active work happens here | Full landing page (`comingSoonEnabled = false`) | Vercel preview / staging URL |

```
┌─────────────────────────────────────────────────────────────┐
│  Daily work                                                 │
│                                                             │
│   feature/fix  ──►  dev  ──►  push origin dev  ──►  preview │
│                                                             │
│  Ready for production                                       │
│                                                             │
│   dev  ──►  merge into main  ──►  push origin main  ──►  live│
└─────────────────────────────────────────────────────────────┘
```

### `dev` — where you work

- All new features, copy changes, and design updates go here first.
- `comingSoonEnabled` is **`false`**, so you see the complete site (Hero, Pricing, FAQ, contact forms, etc.).
- Push here freely to get Vercel preview deployments and share work-in-progress.

### `main` — what is live

- Connected to the production deployment (Vercel production environment).
- `comingSoonEnabled` is **`true`**, so production shows the coming soon page instead of the full landing.
- Only merge into `main` when changes are reviewed and ready to ship (even if the public still sees “coming soon”).

### Golden rules

1. **Never develop directly on `main`.** Check out `dev`, make changes, commit, push.
2. **Never force-push `main`.** Use normal merges.
3. **Keep `comingSoonEnabled` aligned with the branch** — `true` on `main`, `false` on `dev` (see [Coming soon mode](#coming-soon-mode)).

---

## How to push correctly

### Everyday development

```bash
# 1. Make sure you're on dev
git checkout dev
git pull origin dev

# 2. Make your changes, then stage and commit
git add .
git commit -m "Describe what changed and why"

# 3. Push to the remote dev branch
git push origin dev
```

Vercel (if connected) will build a preview deployment from `dev` pushes automatically.

### Ship to production

When `dev` is stable and you want production to pick up the changes:

```bash
# 1. Update dev one last time
git checkout dev
git pull origin dev

# 2. Switch to main and merge dev
git checkout main
git pull origin main
git merge dev

# 3. Set coming soon for production (if not already)
#    Edit src/lib/site.ts → comingSoonEnabled = true

# 4. Commit the flag if you changed it, then push
git push origin main
```

### Launch the full site (go live)

When you're ready to replace the coming soon page with the full landing on production:

```bash
git checkout main
git pull origin main
git merge dev

# Edit src/lib/site.ts on main:
#   comingSoonEnabled = false

git add src/lib/site.ts
git commit -m "Launch full landing page on production"
git push origin main
```

After launch, switch `dev` back to `comingSoonEnabled = false` so local/staging previews stay on the full site.

### Common mistakes to avoid

| Mistake | Why it's a problem | Fix |
|---------|-------------------|-----|
| Pushing features straight to `main` | Skips review; may break production | Always branch from / merge via `dev` |
| `git push --force` on `main` | Rewrites history others rely on | Use `git merge`, never force-push `main` |
| Forgetting `comingSoonEnabled` after merge | Production might show the full site (or hide it) unintentionally | Check `src/lib/site.ts` before every `main` push |
| Pushing without pulling first | Creates merge conflicts on the remote | Always `git pull` before you push |

---

## Coming soon mode

The site can show either the **full landing page** or a **coming soon** page. This is controlled by a single flag in `src/lib/site.ts`:

```ts
/** Set to true to show the coming soon page instead of the full landing. */
export const comingSoonEnabled = false;
```

### How it works

When `comingSoonEnabled` is `true`:

1. **`src/app/[locale]/page.tsx`** renders `<ComingSoon />` instead of all landing sections.
2. **`src/app/[locale]/layout.tsx`** switches metadata (title, description, Open Graph) to the `comingSoon.*` translation keys.
3. **SEO** — `robots` is set to `noindex, nofollow` so search engines don't index the placeholder.
4. **Header** — navigation links are hidden; only the logo and theme/language controls remain.

When `comingSoonEnabled` is `false`:

- The full page renders: Hero, Social Proof, Process, Industries, Lead Preview, Results, Pricing, Plan Comparison, Add-ons, Enterprise, FAQ, and Final CTA.
- Metadata uses the main `metadata.*` keys and allows indexing.

### Copy and translations

Coming soon text lives in the message files:

- `src/messages/en.json` → `comingSoon` section
- `src/messages/nl.json` → `comingSoon` section

Edit those keys to change the badge, headline, description, and metadata without touching components.

### Branch defaults (current setup)

| Branch | `comingSoonEnabled` | Effect |
|--------|---------------------|--------|
| `main` | `true` | Production shows coming soon |
| `dev` | `false` | Staging / local shows full site |

This lets you iterate on the full landing in `dev` while `belgobase.com` stays on the teaser page until launch day.

---

## Internationalization (i18n)

- **Locales:** `en` (default), `nl`
- **URLs:** `/en`, `/nl` (and `/en/...`, `/nl/...` for future routes)
- **Config:** `src/i18n/config.ts`
- **Translations:** `src/messages/en.json`, `src/messages/nl.json`
- **Routing:** `src/proxy.ts` redirects bare paths (e.g. `/`) to the best locale using the `NEXT_LOCALE` cookie or `Accept-Language` header

To add or change copy, edit the JSON message files. Components read strings via `useTranslations()` (client) or `getDictionary()` (server).

---

## Project structure

```
src/
├── app/
│   ├── [locale]/          # Locale-scoped pages and layout
│   │   ├── layout.tsx     # Root layout, metadata, providers
│   │   └── page.tsx       # Home — full landing or coming soon
│   ├── actions/
│   │   └── contact.ts     # Server action: demo/contact emails via Resend
│   ├── robots.ts          # robots.txt (blocks non-production)
│   └── sitemap.ts         # sitemap.xml
├── components/
│   ├── ComingSoon.tsx     # Coming soon page
│   ├── forms/             # Contact and estimate forms
│   ├── layout/            # Header, Footer, StickyCTA, etc.
│   ├── sections/          # Landing page sections
│   ├── seo/               # JSON-LD structured data
│   ├── theme/             # Dark / light toggle
│   ├── ui/                # Reusable UI primitives
│   └── visuals/           # Animated illustrations
├── hooks/                 # Custom React hooks
├── i18n/                  # Locale config and dictionaries
├── lib/
│   ├── email/
│   │   └── resend.ts      # Resend From/To/Reply-To helpers
│   ├── site.ts            # Site URL, coming soon flag, contact info
│   ├── seo/               # Metadata and sitemap helpers
│   ├── theme.ts           # Theme cookie names
│   └── validations/       # Zod schemas for forms
├── messages/              # en.json / nl.json translation files
├── providers/             # Theme, motion, translations context
└── proxy.ts               # Locale detection and redirect
```

---

## Contact form

Demo / contact requests are handled by a Next.js Server Action (`src/app/actions/contact.ts`):

1. Client submits the progressive contact form.
2. Data is validated with Zod (`src/lib/validations/contact.ts`).
3. On success, Resend sends a notification with:
   - **From:** `BelgoBase <noreply@belgobase.be>` (or `RESEND_FROM_EMAIL`)
   - **To:** `ADMIN_EMAIL` / `CONTACT_EMAIL` (a real mailbox)
   - **Reply-To:** the customer's submitted email
4. A honeypot field (`website`) blocks basic bots.

Shared Resend helpers live in `src/lib/email/resend.ts`. The noreply address is only used as From — never as To.

---

## Deployment (Vercel)

The project is designed for [Vercel](https://vercel.com):

| Git branch | Vercel environment | Result |
|------------|-------------------|--------|
| `main` | Production | Live site (`belgobase.com`) |
| `dev` | Preview | Staging URL for review |
| Other branches | Preview | Per-branch preview URLs |

**Local `.env` is not used on Vercel.** Add the same keys in the Vercel project → Settings → Environment Variables (Production), then redeploy.

**Checklist for a new Vercel project:**

1. Import the GitHub repo.
2. Set **Production Branch** to `main`.
3. Add environment variables (`RESEND_API_KEY`, `ADMIN_EMAIL`, optionally `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`) for **Production**.
4. Verify your sending domain in [Resend Domains](https://resend.com/domains) (DNS records for `belgobase.be`).
5. Point your domain (`belgobase.com`) to the production deployment.

`robots.ts` disallows all crawlers on non-production builds (`VERCEL_ENV !== "production"`), so preview URLs stay out of search indexes.

---

## Site configuration reference

All global site settings live in `src/lib/site.ts`:

```ts
export const siteUrl = ...           // Canonical URL for SEO
export const isProduction = ...    // true on Vercel production
export const comingSoonEnabled = ... // Toggle coming soon page
export const contactPhone = ...      // Display phone number
export const contactEmail = ...      // Display email address
```

Change contact details here; they propagate to the Header, Footer, and structured data.

---

## License

Private — © 2026 BelgoBase.
