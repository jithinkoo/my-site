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

  ## Comments

  alias Portfolio.Blog.Comment

  def list_comments(%Post{id: post_id}) do
    Comment
    |> where(post_id: ^post_id)
    |> order_by(asc: :inserted_at, asc: :id)
    |> Repo.all()
  end

  def comment_counts do
    Comment
    |> group_by(:post_id)
    |> select([c], {c.post_id, count(c.id)})
    |> Repo.all()
    |> Map.new()
  end

  def change_comment(attrs \\ %{}), do: Comment.changeset(%Comment{}, attrs)

  def create_comment(%Post{published: true} = post, attrs) do
    %Comment{post_id: post.id}
    |> Comment.changeset(attrs)
    |> Repo.insert()
  end

  def delete_comment(id) do
    case Repo.get(Comment, id) do
      nil -> {:error, :not_found}
      comment -> Repo.delete(comment)
    end
  end

  ## Helpers

  @doc """
  The opening of a post for lists: the summary if there is one, otherwise
  the first ~#{220} characters of the text, cut at a word and ending in "…".
  """
  def excerpt(%Post{summary: summary}) when is_binary(summary) and summary != "" do
    summary
  end

  def excerpt(%Post{body: body}) do
    text = Portfolio.Markdown.to_plain(body)

    if String.length(text) <= 220 do
      text
    else
      text
      |> String.slice(0, 220)
      |> String.replace(~r/\s+\S*$/u, "")
      |> String.trim_trailing(".,;:!?—–- ")
      |> Kernel.<>("…")
    end
  end

  @doc "Minutes to read at ~200 words per minute, at least 1."
  def reading_minutes(%Post{body: body}) do
    words = body |> to_string() |> String.split(~r/\s+/, trim: true) |> length()
    max(1, ceil(words / 200))
  end

  defp maybe_limit(query, nil), do: query
  defp maybe_limit(query, n), do: limit(query, ^n)
end
