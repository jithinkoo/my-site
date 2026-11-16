defmodule PortfolioWeb.Layouts do
  @moduledoc "Root layout plus the public and admin page frames."
  use PortfolioWeb, :html

  embed_templates "layouts/*"

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
  attr :active, :atom, default: nil
  slot :inner_block, required: true

  def app(assigns) do
    ~H"""
    <a class="skip" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="wrap header-row">
        <a href={~p"/"} class="brand">{@profile.name}</a>
        <nav aria-label="Main">
          <a href={~p"/thoughts"} aria-current={@active == :thoughts && "page"}>Thoughts</a>
          <a href={~p"/about"} aria-current={@active == :about && "page"}>About</a>
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
    """
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
