defmodule Portfolio.Repo.Migrations.CreateImages do
  use Ecto.Migration

  # Images live in Postgres because free hosts (e.g. Render) don't keep
  # uploaded files on disk between restarts.
  def change do
    create table(:images) do
      add :filename, :string, null: false
      add :content_type, :string, null: false
      add :byte_size, :integer, null: false
      add :data, :binary, null: false
      add :alt, :string

      timestamps(type: :utc_datetime)
    end

    create constraint(:images, :allowed_type,
             check: "content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')"
           )

    # 5 MB max; byte_size must match the stored data.
    create constraint(:images, :size_limit,
             check: "byte_size > 0 AND byte_size <= 5242880 AND octet_length(data) = byte_size"
           )

    alter table(:profiles) do
      add :photo_image_id, references(:images, on_delete: :nilify_all)
    end
  end
end
