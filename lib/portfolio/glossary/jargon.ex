defmodule Portfolio.Glossary.Jargon do
  use Ecto.Schema
  import Ecto.Changeset

  schema "jargons" do
    field :term, :string
    field :meaning, :string
    field :explanation, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(jargon, attrs) do
    jargon
    |> cast(attrs, [:term, :meaning, :explanation])
    |> update_change(:term, &String.trim/1)
    |> validate_required([:term, :meaning])
    |> validate_length(:term, max: 80)
    |> validate_length(:meaning, max: 200)
    |> unique_constraint(:term, name: :jargons_term_index, message: "is already in the list")
  end
end
