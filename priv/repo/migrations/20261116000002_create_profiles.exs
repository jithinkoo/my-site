defmodule Portfolio.Repo.Migrations.CreateProfiles do
  use Ecto.Migration

  def change do
    create table(:profiles) do
      # Only one profile row may ever exist: the column is always true
      # and unique, so a second insert fails at the database.
      add :singleton, :boolean, null: false, default: true

      add :name, :string, null: false
      add :headline, :string, null: false
      add :intro, :text
      add :about, :text
      add :location, :string
      add :email, :string
      add :linkedin_url, :string
      add :github_url, :string

      timestamps(type: :utc_datetime)
    end

    create unique_index(:profiles, [:singleton])
    create constraint(:profiles, :only_one_profile, check: "singleton = true")
  end
end
