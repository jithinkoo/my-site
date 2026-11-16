defmodule PortfolioWeb.PostHTML do
  use PortfolioWeb, :html

  alias Portfolio.Blog

  embed_templates "post_html/*"

  @doc "One row in a list of posts."
  attr :post, :map, required: true

  def post_item(assigns) do
    ~H"""
    <article class="post-item">
      <a href={~p"/thoughts/#{@post.slug}"} class="post-link">
        <h3>{@post.title}</h3>
        <p :if={@post.summary} class="post-summary">{@post.summary}</p>
      </a>
      <p class="meta">
        <time datetime={DateTime.to_iso8601(@post.published_at)}>{long_date(@post.published_at)}</time>
        · {Blog.reading_minutes(@post)} min read
      </p>
    </article>
    """
  end
end
