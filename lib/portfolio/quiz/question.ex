defmodule Portfolio.Quiz.Question do
  use Ecto.Schema
  import Ecto.Changeset

  schema "questions" do
    field :text, :string
    field :option_a, :string
    field :option_b, :string
    field :correct, :string
    field :active, :boolean, default: true
    field :explanation, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(question, attrs) do
    question
    |> cast(attrs, [:text, :option_a, :option_b, :correct, :active, :explanation])
    |> update_change(:explanation, &blank_to_nil/1)
    |> validate_length(:explanation, max: 120, message: "keep it to one short sentence (120 characters)")
    |> validate_required([:text, :option_a, :option_b, :correct], message: "please fill this in")
    |> validate_length(:text, max: 300)
    |> validate_length(:option_a, max: 120)
    |> validate_length(:option_b, max: 120)
    |> validate_inclusion(:correct, ~w(a b), message: "choose A or B")
    |> check_constraint(:correct, name: :correct_is_a_or_b)
  end

  defp blank_to_nil(nil), do: nil

  defp blank_to_nil(text) do
    case String.trim(text) do
      "" -> nil
      trimmed -> trimmed
    end
  end
end
