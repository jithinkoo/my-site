defmodule PortfolioWeb.Admin.PostController do
  use PortfolioWeb, :controller

  alias Portfolio.Blog
  alias Portfolio.Blog.Post

  def index(conn, _params) do
    render(conn, :index, posts: Blog.list_all_posts(), page_title: "Posts")
  end

  def new(conn, _params) do
    render(conn, :new, form: to_form(Blog.change_post(%Post{})), page_title: "New post")
  end

  def create(conn, %{"post" => params}) do
    case Blog.create_post(params) do
      {:ok, post} ->
        conn
        |> put_flash(:info, saved_message(post))
        |> redirect(to: ~p"/admin/posts/#{post}/edit")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:new, form: to_form(changeset), page_title: "New post")
    end
  end

  def edit(conn, %{"id" => id}) do
    post = Blog.get_post!(id)
    render(conn, :edit, post: post, form: to_form(Blog.change_post(post)), page_title: post.title)
  end

  def update(conn, %{"id" => id, "post" => params}) do
    post = Blog.get_post!(id)

    case Blog.update_post(post, params) do
      {:ok, post} ->
        conn
        |> put_flash(:info, saved_message(post))
        |> redirect(to: ~p"/admin/posts/#{post}/edit")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:edit, post: post, form: to_form(changeset), page_title: post.title)
    end
  end

  def delete(conn, %{"id" => id}) do
    {:ok, _} = id |> Blog.get_post!() |> Blog.delete_post()

    conn
    |> put_flash(:info, "Post deleted.")
    |> redirect(to: ~p"/admin")
  end

  defp saved_message(%Post{published: true}), do: "Saved. It's live on your site."
  defp saved_message(_), do: "Saved as a draft. Only you can see it."
end
