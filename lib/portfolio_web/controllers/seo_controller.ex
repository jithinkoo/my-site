defmodule PortfolioWeb.SeoController do
  @moduledoc "sitemap.xml and robots.txt, built from what's published."
  use PortfolioWeb, :controller

  alias Portfolio.{Blog, Media}
  alias PortfolioWeb.Seo

  def sitemap(conn, _params) do
    posts = Blog.list_published_posts()
    latest = posts |> Enum.map(& &1.updated_at) |> Enum.max(DateTime, fn -> DateTime.utc_now() end)
    gallery = Media.list_gallery()

    pages =
      [
        {"/", latest, "weekly", "1.0"},
        {"/about", nil, "monthly", "0.8"},
        {"/thoughts", latest, "weekly", "0.8"}
      ] ++
        if(gallery != [], do: [{"/gallery", hd(gallery).inserted_at, "monthly", "0.6"}], else: []) ++
        section_pages(posts) ++
        Enum.map(posts, &{Blog.path(&1), &1.updated_at, "monthly", "0.7"})

    urls =
      Enum.map_join(pages, "\n", fn {path, lastmod, freq, priority} ->
        """
          <url>
            <loc>#{esc(Seo.absolute(path))}</loc>#{lastmod_tag(lastmod)}
            <changefreq>#{freq}</changefreq>
            <priority>#{priority}</priority>
          </url>\
        """
      end)

    xml = """
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    #{urls}
    </urlset>
    """

    conn
    |> put_resp_content_type("application/xml")
    |> send_resp(200, xml)
  end

  def robots(conn, _params) do
    body = """
    User-agent: *
    Allow: /
    Disallow: /admin

    Sitemap: #{Seo.absolute("/sitemap.xml")}
    """

    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(200, body)
  end

  # Journey, Places and Jargon pages, when they have something to show.
  defp section_pages(posts) do
    kinds = MapSet.new(posts, & &1.kind)
    journey? = Portfolio.Journey.list_all() != [] or MapSet.member?(kinds, "success") or MapSet.member?(kinds, "failure")

    [
      journey? && {"/journey", nil, "monthly", "0.7"},
      MapSet.member?(kinds, "place") && {"/places", nil, "monthly", "0.7"},
      Portfolio.Glossary.list() != [] && {"/jargon", nil, "monthly", "0.6"}
    ]
    |> Enum.filter(& &1)
  end

  defp lastmod_tag(nil), do: ""
  defp lastmod_tag(%DateTime{} = dt), do: "\n    <lastmod>#{Date.to_iso8601(DateTime.to_date(dt))}</lastmod>"

  defp esc(text), do: text |> Phoenix.HTML.html_escape() |> Phoenix.HTML.safe_to_string()
end
