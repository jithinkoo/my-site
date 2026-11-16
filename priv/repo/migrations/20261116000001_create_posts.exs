defmodule Portfolio.Repo.Migrations.CreatePosts do
  use Ecto.Migration

  def change do
    create table(:posts) do
      add :title, :string, null: false
      add :slug, :string, null: false
      add :summary, :text
      add :body, :text, null: false
      add :published, :boolean, null: false, default: false
      add :published_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create unique_index(:posts, [:slug])
    create index(:posts, [:published, :published_at])

    # A published post must always have a publish date.
    create constraint(:posts, :published_needs_date,
             check: "published = false OR published_at IS NOT NULL"
           )

    # Slugs appear in URLs: lowercase words joined by single hyphens.
    create constraint(:posts, :slug_format, check: "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'")
  end
end
