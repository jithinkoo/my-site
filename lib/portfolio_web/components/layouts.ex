defmodule PortfolioWeb.Layouts do
  @moduledoc "Root layout plus the public and admin page frames."
  use PortfolioWeb, :html

  embed_templates "layouts/*"

  @doc "Image for link previews: the page's own (post cover), else the profile photo."
  def og_image_id(assigns), do: assigns[:meta_image_id] || assigns.profile.photo_image_id

  def site_verification, do: Application.get_env(:portfolio, :google_site_verification)

  def page_title(assigns) do
    name = assigns.profile.name

    case assigns[:page_title] do
      nil -> name
      title -> "#{title} · #{name}"
    end
  end

  @doc "Public page frame: header, content, footer."
  attr :flash, :map, required: true
  attr :profile, :map, required: true
  attr :slides, :list, default: [], doc: "image ids for the background photo loop"
  attr :active, :atom, default: nil
  slot :inner_block, required: true

  def app(assigns) do
    ~H"""
    <a class="skip" href="#main">Skip to content</a>
    <div class={["shell", @slides != [] && "has-photo"]}>
      <.photo_panel :if={@slides != []} profile={@profile} slides={@slides} />

      <div class="content-col">
        <header class="site-header">
          <div class="wrap header-row">
            <a href={~p"/"} class="brand">{@profile.name}</a>
            <nav aria-label="Main">
              <a href={~p"/about"} aria-current={@active == :about && "page"}>About</a>
              <a href={~p"/thoughts"} aria-current={@active == :thoughts && "page"}>Thoughts</a>
              <a href={~p"/gallery"} aria-current={@active == :gallery && "page"}>Gallery</a>
              <.theme_toggle />
            </nav>
          </div>
        </header>

        <main id="main" class="wrap">
          <.flash_group flash={@flash} />
          {render_slot(@inner_block)}
        </main>

        <footer class="site-footer">
          <div class="wrap footer-row">
            <p>© {Date.utc_today().year} {@profile.name}</p>
            <p class="footer-links">
              <a :if={@profile.email} href={"mailto:#{@profile.email}"}>Email</a>
              <a :if={@profile.linkedin_url} href={@profile.linkedin_url} rel="me noopener">LinkedIn</a>
              <a :if={@profile.github_url} href={@profile.github_url} rel="me noopener">GitHub</a>
              <a href={~p"/feed.xml"}>RSS</a>
            </p>
          </div>
        </footer>
      </div>
    </div>
    <script defer src={~p"/assets/js/site.js"}>
    </script>
    """
  end

  @doc """
  Full-height photo on the left (a banner on phones). Quiet and faded by
  default; comes alive on hover, keyboard focus, or tap. With more than one
  photo, they cross-fade in a loop (site.js).
  """
  attr :profile, :map, required: true
  attr :slides, :list, required: true

  def photo_panel(assigns) do
    ~H"""
    <figure class="photo-panel" tabindex="0" data-photo-panel>
      <div class="photo-stack">
        <img
          :for={{id, i} <- Enum.with_index(@slides)}
          src={Portfolio.Media.path(id)}
          alt={if i == 0, do: "Photo of #{@profile.name}", else: ""}
          class={i == 0 && "is-active"}
          fetchpriority={if i == 0, do: "high", else: "low"}
          decoding="async"
        />
      </div>
      <figcaption :if={@profile.photo_caption not in [nil, ""]} class="photo-caption">
        <span
          :for={{line, signature?} <- caption_lines(@profile.photo_caption)}
          class={["caption-line", signature? && "photo-signature"]}
        >
          {line}
        </span>
      </figcaption>
    </figure>
    """
  end

  @doc """
  Splits the photo text into lines. A line starting with a dash is a
  signature: "-Jithin" or "— Jithin" both show as "— Jithin".
  """
  def caption_lines(text) do
    text
    |> String.split(~r/\R/u, trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> split_trailing_signature()
    |> Enum.map(fn line ->
      case Regex.run(~r/^[-–—]+\s*(.+)$/u, line) do
        [_, name] -> {"— " <> capitalize_name(name), true}
        nil -> {line, false}
      end
    end)
  end

  # "Quote here. -Jithin" typed on one line: move the name to its own line.
  # A name of up to three words at the very end counts when it follows
  #   - a hyphen stuck to it:        "... patience. -jithin"
  #   - an en/em dash:               "... patience. — Jithin"
  #   - a spaced hyphen + capital:   "... patience. - Jithin"
  # so ordinary dashes inside a sentence ("a path - and more") are left alone.
  @name ~S"\p{L}[\p{L}.']*(?:\s\p{L}[\p{L}.']*){0,2}"
  @trailing_signature [
    Regex.compile!(~S"^(.*\S)\s+-+(" <> @name <> ")$", "u"),
    Regex.compile!(~S"^(.*\S)\s+[–—]+\s*(" <> @name <> ")$", "u"),
    Regex.compile!(~S"^(.*\S)\s+-+\s+(\p{Lu}[\p{L}.']*(?:\s\p{L}[\p{L}.']*){0,2})$", "u")
  ]

  defp split_trailing_signature(lines) do
    already_signed? = Enum.any?(lines, &Regex.match?(~r/^[-–—]/u, &1))
    last = List.last(lines)

    match =
      if not already_signed? and is_binary(last),
        do: Enum.find_value(@trailing_signature, &Regex.run(&1, last))

    case match do
      [_, quote, name] -> List.replace_at(lines, -1, quote) ++ ["— " <> capitalize_name(name)]
      _ -> lines
    end
  end

  # "jithin k" -> "Jithin K"
  defp capitalize_name(name) do
    name
    |> String.split(~r/\s+/u, trim: true)
    |> Enum.map_join(" ", fn word ->
      {first, rest} = String.split_at(word, 1)
      String.upcase(first) <> rest
    end)
  end

  @doc "Admin page frame."
  attr :flash, :map, required: true
  slot :inner_block, required: true

  def admin(assigns) do
    ~H"""
    <header class="site-header">
      <div class="wrap wrap-wide header-row">
        <a href={~p"/admin"} class="brand">Admin</a>
        <nav aria-label="Admin">
          <a href={~p"/admin"}>Posts</a>
          <a href={~p"/admin/images"}>Images &amp; gallery</a>
          <a href={~p"/admin/profile"}>Profile</a>
          <a href={~p"/"} target="_blank">View site ↗</a>
          <.form for={%{}} action={~p"/admin/logout"} method="delete" class="inline-form">
            <button type="submit" class="link-button">Log out</button>
          </.form>
          <.theme_toggle />
        </nav>
      </div>
    </header>
    <main id="main" class="wrap wrap-wide">
      <.flash_group flash={@flash} />
      {render_slot(@inner_block)}
    </main>
    <script defer src={~p"/assets/js/admin.js"}>
    </script>
    """
  end

  defp theme_toggle(assigns) do
    ~H"""
    <button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch light or dark theme">
      <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    """
  end
end
