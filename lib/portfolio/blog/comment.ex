defmodule Portfolio.Blog.Comment do
  use Ecto.Schema
  import Ecto.Changeset

  schema "comments" do
    belongs_to :post, Portfolio.Blog.Post
    field :name, :string
    field :body, :string

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(comment, attrs) do
    comment
    |> cast(attrs, [:name, :body])
    |> update_change(:name, &squish/1)
    |> update_change(:body, &String.trim/1)
    |> validate_required([:name, :body], message: "please fill this in")
    |> validate_length(:name, max: 60)
    |> validate_length(:body, max: 1000)
    |> check_constraint(:body, name: :body_length)
    |> check_constraint(:name, name: :name_length)
  end

  defp squish(text), do: text |> String.split() |> Enum.join(" ")
end
