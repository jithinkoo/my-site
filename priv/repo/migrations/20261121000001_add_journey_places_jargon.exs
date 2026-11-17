defmodule Portfolio.Repo.Migrations.AddJourneyPlacesJargon do
  use Ecto.Migration

  def change do
    # Posts now have a type: a thought, a success or failure story, or a place.
    alter table(:posts) do
      add :kind, :string, null: false, default: "thought"
      add :location, :string, size: 120
      add :visited_on, :date
    end

    create index(:posts, [:kind, :published, :published_at])

    create constraint(:posts, :known_kind,
             check: "kind IN ('thought', 'success', 'failure', 'place')"
           )

    # Goals and achievements shown on the Journey page.
    create table(:milestones) do
      add :kind, :string, null: false
      add :title, :string, size: 160, null: false
      add :description, :text
      add :when_label, :string, size: 40
      add :status, :string
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:milestones, [:kind, :position])
    create constraint(:milestones, :known_kind, check: "kind IN ('achievement', 'goal')")

    create constraint(:milestones, :known_status,
             check: "status IS NULL OR status IN ('dreaming', 'working', 'done')"
           )

    # "Jargon, simply explained".
    create table(:jargons) do
      add :term, :string, size: 80, null: false
      add :meaning, :string, size: 200, null: false
      add :explanation, :text

      timestamps(type: :utc_datetime)
    end

    create unique_index(:jargons, ["lower(term)"], name: :jargons_term_index)
  end
end
