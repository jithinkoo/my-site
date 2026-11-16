defmodule PortfolioWeb.PostController do
  use PortfolioWeb, :controller

  alias Portfolio.Blog

  def index(conn, _params) do
    render(conn, :index, posts: Blog.list_published_posts(), page_title: "Thoughts")
  end

  def show(conn, %{"slug" => slug}) do
    case Blog.get_published_post_by_slug(slug) do
      nil ->
        conn
        |> put_status(:not_found)
        |> put_root_layout(false)
        |> put_view(html: PortfolioWeb.ErrorHTML)
        |> render(:"404")

      post ->
        render(conn, :show,
          post: post,
          page_title: post.title,
          meta_description: post.summary
        )
    end
  end
end
