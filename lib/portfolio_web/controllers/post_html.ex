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
        href={Blog.path(@post)}
        class="post-thumb"
        tabindex="-1"
        aria-hidden="true"
      >
        <img src={Portfolio.Media.path(@post.cover_image_id)} alt="" loading="lazy" />
      </a>
      <div class="post-text">
        <h3><a href={Blog.path(@post)} class="post-title-link">{@post.title}</a></h3>
        <p class="post-summary">{Blog.excerpt(@post)}</p>
        <p class="meta">
          <time datetime={DateTime.to_iso8601(@post.published_at)}>{long_date(@post.published_at)}</time>
          · {Blog.reading_minutes(@post)} min read
          <span :if={@comments > 0}>· {@comments} {if @comments == 1, do: "comment", else: "comments"}</span>
          <a href={Blog.path(@post)} class="read-more">
            Read more<span class="sr-only">: {@post.title}</span> →
          </a>
        </p>
      </div>
    </article>
    """
  end

  @doc "A place as a card: cover photo, name, location, when, opening lines."
  attr :post, :map, required: true

  def place_card(assigns) do
    ~H"""
    <article class="place-card">
      <a href={Blog.path(@post)} class="place-photo" tabindex="-1" aria-hidden="true">
        <img :if={@post.cover_image_id} src={Portfolio.Media.path(@post.cover_image_id)} alt="" loading="lazy" />
        <span :if={!@post.cover_image_id} class="place-photo-empty">📍</span>
      </a>
      <div class="place-body">
        <h3><a href={Blog.path(@post)} class="post-title-link">{@post.title}</a></h3>
        <p class="meta">
          <span :if={@post.location}>📍 {@post.location}</span>
          <span :if={@post.location && @post.visited_on}> · </span>
          <span :if={@post.visited_on}>{Calendar.strftime(@post.visited_on, "%B %Y")}</span>
        </p>
        <p class="post-summary">{Blog.excerpt(@post)}</p>
        <a href={Blog.path(@post)} class="read-more">
          Read more<span class="sr-only">: {@post.title}</span> →
        </a>
      </div>
    </article>
    """
  end

  def back_path(%{kind: "place"}), do: ~p"/places"
  def back_path(%{kind: kind}) when kind in ["success", "failure"], do: ~p"/journey"
  def back_path(_), do: ~p"/thoughts"

  def back_label(%{kind: "place"}), do: "All places"
  def back_label(%{kind: kind}) when kind in ["success", "failure"], do: "Back to my journey"
  def back_label(_), do: "All thoughts"

  def comment_time(%DateTime{} = dt), do: Calendar.strftime(dt, "%-d %b %Y")
end
