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

## 3. Deploy free on Gigalixir

Gigalixir is a hosting service made for Elixir. Its free tier gives one
small app and a small free Postgres database. Check
https://www.gigalixir.com/pricing for current limits.

```bash
pip3 install gigalixir          # the Gigalixir command-line tool
gigalixir signup                # or: gigalixir login
gigalixir create -n <your-app-name>
gigalixir pg:create --free      # free Postgres; sets DATABASE_URL for you
```

Set your admin password (12+ characters, used only by you):

```bash
gigalixir config:set ADMIN_PASSWORD='choose-a-long-unique-password'
```

Set the public host name (change later if you add a custom domain):

```bash
gigalixir config:set PHX_HOST=<your-app-name>.gigalixirapp.com
```

Deploy (this builds the app and runs database migrations on start):

```bash
git push gigalixir main
```

Open `https://<your-app-name>.gigalixirapp.com`, then go to `/admin`.

Notes:
- `SECRET_KEY_BASE` and `DATABASE_URL` are set by Gigalixir automatically.
- The free database allows very few connections, so the app uses a pool of 2
  (`POOL_SIZE`).
- If the build complains about the Erlang/Elixir versions, edit
  `elixir_buildpack.config` to versions Gigalixir's build supports.
- The app listens on IPv4. If a host needs IPv6, set `BIND_IPV6=true`.
- Logs: `gigalixir logs`

---

## 4. Free domain: `yourname.is-a.dev`

[is-a.dev](https://is-a.dev) gives developers a free subdomain. You
request it with a small pull request on GitHub.

1. Fork https://github.com/is-a-dev/register
2. Add a file `domains/<yourname>.json`. Follow the format in their README,
   pointing a `CNAME` record at `<your-app-name>.gigalixirapp.com`.
3. Open a pull request and wait for approval (usually a few days; read
   their rules first, since they check that the site is a real personal site).
4. Tell Gigalixir about the domain and update the host:

```bash
gigalixir domains:add <yourname>.is-a.dev
gigalixir config:set PHX_HOST=<yourname>.is-a.dev
```

HTTPS certificates are issued automatically.

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

Untick **Published** to keep a post as a private draft.

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
