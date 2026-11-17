defmodule PortfolioWeb.PostHTML do
  use PortfolioWeb, :html

  alias Portfolio.Blog

  embed_templates "post_html/*"

  @doc """
  One row in a list of posts: title, the opening lines ending in "…",
  and a "Read more" link. Shows the cover image as a thumbnail if set.
  """
  attr :post, :map, required: true
  attr :comments, :integer, default: 0

  def post_item(assigns) do
    ~H"""
    <article class={["post-item", @post.cover_image_id && "has-thumb"]}>
      <a
        :if={@post.cover_image_id}
        href={~p"/thoughts/#{@post.slug}"}
        class="post-thumb"
        tabindex="-1"
        aria-hidden="true"
      >
        <img src={Portfolio.Media.path(@post.cover_image_id)} alt="" loading="lazy" />
      </a>
      <div class="post-text">
        <h3><a href={~p"/thoughts/#{@post.slug}"} class="post-title-link">{@post.title}</a></h3>
        <p class="post-summary">{Blog.excerpt(@post)}</p>
        <p class="meta">
          <time datetime={DateTime.to_iso8601(@post.published_at)}>{long_date(@post.published_at)}</time>
          · {Blog.reading_minutes(@post)} min read
          <span :if={@comments > 0}>· {@comments} {if @comments == 1, do: "comment", else: "comments"}</span>
          <a href={~p"/thoughts/#{@post.slug}"} class="read-more">
            Read more<span class="sr-only">: {@post.title}</span> →
          </a>
        </p>
      </div>
    </article>
    """
  end

  def comment_time(%DateTime{} = dt), do: Calendar.strftime(dt, "%-d %b %Y")
end
