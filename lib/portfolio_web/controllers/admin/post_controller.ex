defmodule PortfolioWeb.Admin.PostController do
  use PortfolioWeb, :controller

  alias Portfolio.{Blog, Media}
  alias Portfolio.Blog.Post

  def index(conn, _params) do
    render(conn, :index,
      posts: Blog.list_all_posts(),
      comment_counts: Blog.comment_counts(),
      page_title: "Posts"
    )
  end

  def new(conn, _params) do
    render(conn, :new, form: to_form(Blog.change_post(%Post{})), page_title: "New post")
  end

  def create(conn, %{"post" => params}) do
    with {:ok, params} <- cover_params(params),
         {:ok, post} <- Blog.create_post(params) do
      conn
      |> put_flash(:info, saved_message(post))
      |> redirect(to: ~p"/admin/posts/#{post}/edit")
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:new, form: to_form(changeset), page_title: "New post")

      {:error, message} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_flash(:error, message)
        |> render(:new, form: to_form(Blog.change_post(%Post{}, drop_files(params))), page_title: "New post")
    end
  end

  def edit(conn, %{"id" => id}) do
    post = Blog.get_post!(id)
    render(conn, :edit, post: post, form: to_form(Blog.change_post(post)), page_title: post.title)
  end

  def update(conn, %{"id" => id, "post" => params}) do
    post = Blog.get_post!(id)

    with {:ok, params} <- cover_params(params),
         {:ok, post} <- Blog.update_post(post, params) do
      conn
      |> put_flash(:info, saved_message(post))
      |> redirect(to: ~p"/admin/posts/#{post}/edit")
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:edit, post: post, form: to_form(changeset), page_title: post.title)

      {:error, message} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_flash(:error, message)
        |> render(:edit, post: post, form: to_form(Blog.change_post(post, drop_files(params))), page_title: post.title)
    end
  end

  def delete(conn, %{"id" => id}) do
    {:ok, _} = id |> Blog.get_post!() |> Blog.delete_post()

    conn
    |> put_flash(:info, "Post deleted.")
    |> redirect(to: ~p"/admin")
  end

  # The cover id is only ever set from a fresh upload or cleared on request;
  # it is never taken directly from the submitted form.
  defp cover_params(params) do
    params = Map.delete(params, "cover_image_id")

    case params do
      %{"cover" => %Plug.Upload{filename: name} = upload} when name not in [nil, ""] ->
        with {:ok, image} <- Media.create_from_upload(upload, params["title"]) do
          {:ok, params |> Map.delete("cover") |> Map.put("cover_image_id", image.id)}
        end

      %{"remove_cover" => "true"} ->
        {:ok, params |> Map.delete("cover") |> Map.put("cover_image_id", nil)}

      _ ->
        {:ok, Map.delete(params, "cover")}
    end
  end

  defp drop_files(params), do: Map.drop(params, ["cover", "cover_image_id"])

  defp saved_message(%Post{published: true}), do: "Saved. It's live on your site."
  defp saved_message(_), do: "Saved as a draft. Only you can see it."
end
