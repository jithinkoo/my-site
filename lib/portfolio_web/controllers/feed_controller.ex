defmodule PortfolioWeb.FeedController do
  @moduledoc "RSS 2.0 feed of the 20 most recent published posts."
  use PortfolioWeb, :controller

  alias Portfolio.{Blog, Profiles}

  def index(conn, _params) do
    profile = Profiles.get_profile()
    posts = Blog.list_published_posts(limit: 20)
    base = url(~p"/")

    items =
      Enum.map_join(posts, "\n", fn post ->
        link = PortfolioWeb.Endpoint.url() <> Blog.path(post)

        """
            <item>
              <title>#{esc(post.title)}</title>
              <link>#{esc(link)}</link>
              <guid isPermaLink="true">#{esc(link)}</guid>
              <pubDate>#{rfc822(post.published_at)}</pubDate>
              <description>#{esc(post.summary || "")}</description>
            </item>\
        """
      end)

    xml = """
    <?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>#{esc(profile.name)}: Thoughts</title>
        <link>#{esc(base)}</link>
        <description>#{esc(profile.headline)}</description>
        <language>en</language>
    #{items}
      </channel>
    </rss>
    """

    conn
    |> put_resp_content_type("application/rss+xml")
    |> send_resp(200, xml)
  end

  defp esc(text) do
    text |> Phoenix.HTML.html_escape() |> Phoenix.HTML.safe_to_string()
  end

  defp rfc822(%DateTime{} = dt), do: Calendar.strftime(dt, "%a, %d %b %Y %H:%M:%S +0000")
end
