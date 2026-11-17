defmodule PortfolioWeb.PostController do
  use PortfolioWeb, :controller

  alias Portfolio.{Blog, RateLimiter}

  # At most this many comments per visitor in the window below.
  @comment_limit 3
  @comment_window_ms 10 * 60 * 1000

  def index(conn, _params) do
    render(conn, :index,
      posts: Blog.list_published_posts(),
      comment_counts: Blog.comment_counts(),
      page_title: "Thoughts"
    )
  end

  def show(conn, %{"slug" => slug}) do
    case Blog.get_published_post_by_slug(slug) do
      nil -> not_found(conn)
      post -> render_post(conn, post, Blog.change_comment())
    end
  end

  def create_comment(conn, %{"slug" => slug} = params) do
    attrs = Map.get(params, "comment", %{})

    case Blog.get_published_post_by_slug(slug) do
      nil ->
        not_found(conn)

      post ->
        cond do
          # Hidden field that people never see; bots fill it in.
          attrs["website"] not in [nil, ""] ->
            conn
            |> put_flash(:info, "Thanks for your comment.")
            |> redirect(to: ~p"/thoughts/#{post.slug}" <> "#comments")

          RateLimiter.hit(visitor_key(conn), @comment_limit, @comment_window_ms) != :ok ->
            conn
            |> put_status(:too_many_requests)
            |> put_flash(:error, "You've commented a few times just now. Please wait a few minutes.")
            |> render_post(post, Blog.change_comment(attrs))

          true ->
            case Blog.create_comment(post, attrs) do
              {:ok, _comment} ->
                conn
                |> put_flash(:info, "Thanks! Your comment is up.")
                |> redirect(to: ~p"/thoughts/#{post.slug}" <> "#comments")

              {:error, changeset} ->
                conn
                |> put_status(:unprocessable_entity)
                |> render_post(post, changeset)
            end
        end
    end
  end

  defp render_post(conn, post, comment_changeset) do
    render(conn, :show,
      post: post,
      comments: Blog.list_comments(post),
      comment_form: to_form(comment_changeset, as: :comment),
      page_title: post.title,
      meta_description: Blog.excerpt(post),
      meta_image_id: post.cover_image_id
    )
  end

  defp not_found(conn) do
    conn
    |> put_status(:not_found)
    |> put_root_layout(false)
    |> put_view(html: PortfolioWeb.ErrorHTML)
    |> render(:"404")
  end

  # Behind Render's proxy the visitor's address is in x-forwarded-for.
  # It is only hashed in memory for the rate limit, never stored.
  defp visitor_key(conn) do
    case get_req_header(conn, "x-forwarded-for") do
      [forwarded | _] -> forwarded |> String.split(",") |> hd() |> String.trim()
      [] -> conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end
end
