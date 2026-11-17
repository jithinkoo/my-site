defmodule Portfolio.Repo.Migrations.CreateComments do
  use Ecto.Migration

  # Visitor comments under posts: a name and the comment, nothing else.
  # No email, no IP address.
  def change do
    create table(:comments) do
      add :post_id, references(:posts, on_delete: :delete_all), null: false
      add :name, :string, size: 60, null: false
      add :body, :text, null: false

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:comments, [:post_id, :inserted_at])
    create constraint(:comments, :body_length, check: "char_length(body) BETWEEN 1 AND 1000")
    create constraint(:comments, :name_length, check: "char_length(name) BETWEEN 1 AND 60")
  end
end
