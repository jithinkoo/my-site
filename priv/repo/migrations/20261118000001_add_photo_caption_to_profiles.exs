defmodule Portfolio.Repo.Migrations.AddPhotoCaptionToProfiles do
  use Ecto.Migration

  def change do
    alter table(:profiles) do
      # Short text shown over the full-height photo.
      add :photo_caption, :string, size: 200
    end
  end
end
