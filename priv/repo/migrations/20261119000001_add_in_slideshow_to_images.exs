defmodule Portfolio.Repo.Migrations.AddInSlideshowToImages do
  use Ecto.Migration

  def change do
    alter table(:images) do
      # Shown in the background photo loop (after the profile photo).
      add :in_slideshow, :boolean, null: false, default: false
    end

    create index(:images, [:in_slideshow])
  end
end
