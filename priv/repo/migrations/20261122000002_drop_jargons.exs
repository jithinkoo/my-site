defmodule Portfolio.Repo.Migrations.DropJargons do
  use Ecto.Migration

  # The Jargon section was removed from the site.
  def up do
    drop_if_exists table(:jargons)
  end

  def down do
    create table(:jargons) do
      add :term, :string, size: 80, null: false
      add :meaning, :string, size: 200, null: false
      add :explanation, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:jargons, ["lower(term)"], name: :jargons_term_index)
  end
end
