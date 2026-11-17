defmodule Portfolio.Repo.Migrations.AddExplanationToQuestions do
  use Ecto.Migration

  def change do
    alter table(:questions) do
      # Shown only after a wrong answer.
      add :explanation, :text
    end
  end
end
