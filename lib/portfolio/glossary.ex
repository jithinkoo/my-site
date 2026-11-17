defmodule Portfolio.Glossary do
  @moduledoc "\"Jargon, simply explained\": terms with a plain meaning."

  import Ecto.Query
  alias Portfolio.Repo
  alias Portfolio.Glossary.Jargon

  def list do
    Jargon
    |> order_by([j], asc: fragment("lower(?)", j.term))
    |> Repo.all()
  end

  def get!(id), do: Repo.get!(Jargon, id)

  def change(%Jargon{} = j, attrs \\ %{}), do: Jargon.changeset(j, attrs)

  def create(attrs), do: %Jargon{} |> Jargon.changeset(attrs) |> Repo.insert()

  def update(%Jargon{} = j, attrs), do: j |> Jargon.changeset(attrs) |> Repo.update()

  def delete(%Jargon{} = j), do: Repo.delete(j)

  @doc "Anchor id for a term: \"API Gateway\" -> \"api-gateway\"."
  def anchor(%Jargon{term: term}), do: "term-" <> Portfolio.Blog.Post.slugify(term)

  @doc "First letter for the A–Z index (non-Latin terms go under #)."
  def letter(%Jargon{term: term}) do
    first = term |> String.trim() |> String.first() |> to_string() |> String.upcase()
    if first =~ ~r/^[A-Z]$/, do: first, else: "#"
  end
end
