defmodule Portfolio.Blog do
  @moduledoc "Posts: public reading and private writing."

  import Ecto.Query
  alias Portfolio.Repo
  alias Portfolio.Blog.Post

  ## Public

  def list_published_posts(opts \\ []) do
    Post
    |> where(published: true)
    |> order_by(desc: :published_at, desc: :id)
    |> maybe_limit(opts[:limit])
    |> Repo.all()
  end

  def get_published_post_by_slug(slug) do
    Repo.get_by(Post, slug: slug, published: true)
  end

  ## Admin

  def list_all_posts do
    Post
    |> order_by([p], desc: p.published, desc_nulls_first: p.published_at, desc: p.inserted_at)
    |> Repo.all()
  end

  def get_post!(id), do: Repo.get!(Post, id)

  def change_post(%Post{} = post, attrs \\ %{}), do: Post.changeset(post, attrs)

  def create_post(attrs), do: %Post{} |> Post.changeset(attrs) |> Repo.insert()

  def update_post(%Post{} = post, attrs), do: post |> Post.changeset(attrs) |> Repo.update()

  def delete_post(%Post{} = post), do: Repo.delete(post)

  ## Helpers

  @doc "Minutes to read at ~200 words per minute, at least 1."
  def reading_minutes(%Post{body: body}) do
    words = body |> to_string() |> String.split(~r/\s+/, trim: true) |> length()
    max(1, ceil(words / 200))
  end

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, n), do: limit(query, ^n)
end
