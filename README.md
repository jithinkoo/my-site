# My personal site

A quiet personal site for your story and your thoughts. Built with
Elixir + Phoenix and Postgres. No CSS framework, no JavaScript build step.

- **Home**: your name, a one-line headline, a short intro, latest thoughts
- **About**: your story, in plain language
- **Thoughts**: your posts (Markdown), each with date and reading time
- **RSS** at `/feed.xml`, so people can follow you
- **Light / dark theme**: follows the visitor's system, with a toggle
- **Admin** at `/admin`: one password. Write posts, publish or hide them,
  and edit your profile. Everything is stored in Postgres.

---

## 1. Run it on your laptop

You need Erlang 28 + Elixir 1.20 (see `.tool-versions`; `asdf install`
or `mise install` reads it) and Postgres running locally with user
`postgres` / password `postgres` (change in `config/dev.exs`).

```bash
mix setup          # install deps, create DB, run migrations, add a sample post
mix phx.server     # open http://localhost:4000
```

Admin: http://localhost:4000/admin, local password `local-admin-pass`.

First thing to do: open **Admin → Profile** and fill in your name,
headline, intro, about story and links. Then edit or delete the sample post.

Run the tests: `mix test`

---

## 2. Put your code on GitHub

Create an empty **public or private** repository on GitHub (e.g. `my-site`), then:

```bash
git init
git add .
git commit -m "My personal site"
git branch -M main
git remote add origin https://github.com/<your-username>/my-site.git
git push -u origin main
```

---

## 3. Deploy free: Neon (database) + Render (app), no card

Both are free without a credit card at the time of writing. Check
https://neon.com/pricing and https://render.com/docs/free for current limits.

### 3a. Database on Neon

1. Sign up at https://neon.com (you can use "Sign in with GitHub").
2. Create a project (any name, pick the region closest to you, e.g. Singapore).
3. On the project dashboard, click **Connect** and copy the connection string.
   It looks like
   `postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   Keep it private: it contains the database password.

### 3b. A secret key for the app

Run this once on your laptop and copy the output (keep it private):

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 3c. App on Render

1. Sign up at https://render.com with your GitHub account.
2. **New → Web Service → Build and deploy from a Git repository**, pick `my-site`.
3. Render detects the `Dockerfile`. Choose:
   - **Language/Runtime:** Docker
   - **Instance type:** Free
4. Under **Environment Variables** add:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string from 3a |
| `SECRET_KEY_BASE` | the output of the python command in 3b |
| `ADMIN_PASSWORD` | a long password (12+ characters) for `/admin` |
| `PHX_HOST` | `<your-service-name>.onrender.com` |

5. Click **Create Web Service**. The first build takes several minutes.
   Database tables are created automatically when the app starts.

Open `https://<your-service-name>.onrender.com`, then go to `/admin`.

Every `git push` to `main` redeploys the site automatically.

Notes:
- Free Render services sleep after ~15 minutes without visitors. The first
  visit after that takes up to about a minute; then it's fast again.
- Neon's free database also sleeps when idle and wakes on the next query.
- The free database allows few connections, so the app uses a pool of 2
  (`POOL_SIZE`).
- `DATABASE_SSL` defaults to `verify` (encrypted, certificate checked).
- The app listens on IPv4. If a host needs IPv6, set `BIND_IPV6=true`.
- Logs: Render dashboard → your service → **Logs**.

---

## 4. Free domain: `yourname.is-a.dev`

[is-a.dev](https://is-a.dev) gives developers a free subdomain. You
request it with a small pull request on GitHub.

1. Fork https://github.com/is-a-dev/register
2. Add a file `domains/<yourname>.json`. Follow the format in their README,
   pointing a `CNAME` record at `<your-service-name>.onrender.com`.
3. Open a pull request and wait for approval (usually a few days; read
   their rules first, since they check that the site is a real personal site).
4. In Render: your service → **Settings → Custom Domains → Add**
   `<yourname>.is-a.dev`. Then change the `PHX_HOST` environment variable
   to `<yourname>.is-a.dev`.

Render issues the HTTPS certificate automatically.

---

## Writing posts

Admin → **Write a new post**. Posts use Markdown:

| You type | You get |
|---|---|
| blank line | new paragraph |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `## Heading` | a section heading |
| `> quote` | a quote |
| `- item` | a bulleted list |
| `[text](https://...)` | a link |
| `---` | a decorative break |
| `![description](/media/12)` | an image (copy the line from Admin → Images) |

Untick **Published** to keep a post as a private draft.

## Comments

Every published post has a comment form (name + comment). Comments appear
straight away, as plain text. No email or IP address is stored. Bots are
caught by a hidden field, and one visitor can post at most 3 comments in
10 minutes. While logged in as admin, each comment shows a **Delete comment**
button; Admin → Posts shows comment counts.

## Gallery

Admin → **Images & gallery**: tick **Show on the Gallery page** when
uploading (and add a place), or edit any photo's caption, place and
"In gallery" box later. The public **Gallery** page shows them as a grid;
clicking a photo opens it large.

## Getting found on Google

The site already serves `/sitemap.xml` and `/robots.txt`, a canonical
address on every page, link-preview tags and structured data.

1. Open https://search.google.com/search-console and add your site as a
   **URL prefix** (e.g. `https://jithin.onrender.com`).
2. Choose the **HTML tag** method. Copy only the `content="..."` value.
3. In Render → Environment add `GOOGLE_SITE_VERIFICATION` with that value,
   save and wait for the redeploy, then click **Verify** in Search Console.
4. In Search Console → **Sitemaps**, submit `sitemap.xml`.
5. Optional: Bing Webmaster Tools can import your Search Console site.

## Photos and images

- **Your photo:** Admin → **Profile** → Photo. It shows round on the home
  and About pages, and in link previews (WhatsApp, LinkedIn).
- **Images for posts:** Admin → **Images** → upload, then copy the line
  shown under the image into your post, on its own line.
- JPEG, PNG, WebP or GIF, up to 5 MB. Large photos are shrunk in your
  browser before upload (to about 1600 px), so phone photos are fine.
- Images are stored in the Postgres database, not on disk, because free
  hosts like Render delete files on disk whenever the app restarts.

---

## How it fits together

| Path | What |
|---|---|
| `lib/portfolio/blog.ex`, `blog/post.ex` | Posts: public queries, slugs, publish date |
| `lib/portfolio/profiles.ex`, `profiles/profile.ex` | Your single profile |
| `lib/portfolio_web/router.ex` | All routes |
| `lib/portfolio_web/admin_auth.ex` | Admin password check and login session |
| `lib/portfolio_web/controllers/` | Pages, posts, RSS, admin |
| `lib/portfolio_web/components/layouts*` | Page frame, header, footer, theme toggle |
| `priv/static/assets/css/app.css` | All styling (colour tokens at the top) |
| `priv/repo/migrations/` | Database tables and constraints |

Database rules are enforced by Postgres itself, not only by the app:
unique post addresses, only one profile row, and a published post
must always have a publish date.
