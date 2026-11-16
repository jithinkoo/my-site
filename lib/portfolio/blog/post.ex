defmodule Portfolio.Blog.Post do
  use Ecto.Schema
  import Ecto.Changeset

  @slug_format ~r/^[a-z0-9]+(-[a-z0-9]+)*$/

  schema "posts" do
    field :title, :string
    field :slug, :string
    field :summary, :string
    field :body, :string
    field :published, :boolean, default: false
    field :published_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(post, attrs) do
    post
    |> cast(attrs, [:title, :slug, :summary, :body, :published])
    |> validate_required([:title, :body])
    |> validate_length(:title, max: 200)
    |> validate_length(:summary, max: 400)
    |> put_slug()
    |> validate_required([:slug])
    |> validate_format(:slug, @slug_format,
      message: "use lowercase letters, numbers and single hyphens"
    )
    |> put_published_at()
    |> unique_constraint(:slug)
    |> check_constraint(:slug, name: :slug_format)
    |> check_constraint(:published, name: :published_needs_date)
  end

  @doc "Turns a title into a URL-safe slug: \"Hello, World!\" -> \"hello-world\"."
  def slugify(nil), do: nil

  def slugify(text) do
    text
    |> String.normalize(:nfd)
    |> String.replace(~r/[^\x00-\x7F]/u, "")
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "-")
    |> String.trim("-")
    |> String.slice(0, 80)
    |> String.trim("-")
  end

  defp put_slug(changeset) do
    case get_field(changeset, :slug) do
      blank when blank in [nil, ""] ->
        put_change(changeset, :slug, slugify(get_field(changeset, :title)))

      _ ->
        update_change(changeset, :slug, &slugify/1)
    end
  end

  # First publish stamps the date; unpublishing and republishing keeps it.
  defp put_published_at(changeset) do
    if get_field(changeset, :published) and is_nil(get_field(changeset, :published_at)) do
      put_change(changeset, :published_at, DateTime.utc_now(:second))
    else
      changeset
    end
  end
end
