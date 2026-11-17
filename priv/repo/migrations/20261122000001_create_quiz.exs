defmodule Portfolio.Repo.Migrations.CreateQuiz do
  use Ecto.Migration

  def change do
    # Two-option questions, written in the admin.
    create table(:questions) do
      add :text, :string, size: 300, null: false
      add :option_a, :string, size: 120, null: false
      add :option_b, :string, size: 120, null: false
      add :correct, :string, size: 1, null: false
      add :active, :boolean, null: false, default: true

      timestamps(type: :utc_datetime)
    end

    create constraint(:questions, :correct_is_a_or_b, check: "correct IN ('a', 'b')")

    # Finished quiz runs; the best one is shown to everyone as the high score.
    create table(:quiz_scores) do
      add :name, :string, size: 40, null: false
      add :score, :integer, null: false
      add :correct_count, :integer, null: false
      add :duration_ms, :integer, null: false

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:quiz_scores, [:score, :duration_ms])
    create constraint(:quiz_scores, :sane_numbers, check: "score >= 0 AND correct_count >= 0 AND duration_ms >= 0")
  end
end
