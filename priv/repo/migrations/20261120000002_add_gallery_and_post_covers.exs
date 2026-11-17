defmodule Portfolio.Repo.Migrations.AddGalleryAndPostCovers do
  use Ecto.Migration

  def change do
    # Gallery: any uploaded image can be shown on /gallery with a place.
    alter table(:images) do
      add :in_gallery, :boolean, null: false, default: false
      add :place, :string, size: 120
    end

    create index(:images, [:in_gallery])

    # Optional cover image for a post.
    alter table(:posts) do
      add :cover_image_id, references(:images, on_delete: :nilify_all)
    end
  end
end
