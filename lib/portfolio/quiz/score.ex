defmodule Portfolio.Quiz.Score do
  use Ecto.Schema
  import Ecto.Changeset

  schema "quiz_scores" do
    field :name, :string
    field :score, :integer
    field :correct_count, :integer
    field :duration_ms, :integer

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(score, attrs) do
    score
    |> cast(attrs, [:name, :score, :correct_count, :duration_ms])
    |> validate_required([:name, :score, :correct_count, :duration_ms])
    |> validate_length(:name, min: 1, max: 40)
    |> validate_number(:score, greater_than_or_equal_to: 0)
    |> check_constraint(:score, name: :sane_numbers)
  end
end
