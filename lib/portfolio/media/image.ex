defmodule Portfolio.Media.Image do
  use Ecto.Schema
  import Ecto.Changeset

  @types ~w(image/jpeg image/png image/webp image/gif)
  @max_bytes 5 * 1024 * 1024

  def max_bytes, do: @max_bytes

  schema "images" do
    field :filename, :string
    field :content_type, :string
    field :byte_size, :integer
    field :data, :binary, redact: true
    field :alt, :string
    field :in_slideshow, :boolean, default: false
    field :in_gallery, :boolean, default: false
    field :place, :string

    timestamps(type: :utc_datetime)
  end

  @doc "Caption, place and gallery flag, edited on the admin Images page."
  def details_changeset(image, attrs) do
    image
    |> cast(attrs, [:alt, :place, :in_gallery])
    |> update_change(:alt, &blank_to_nil/1)
    |> update_change(:place, &blank_to_nil/1)
    |> validate_length(:alt, max: 255)
    |> validate_length(:place, max: 120)
  end

  defp blank_to_nil(nil), do: nil

  defp blank_to_nil(text) do
    case String.trim(text) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  def changeset(image, attrs) do
    image
    |> cast(attrs, [:filename, :content_type, :byte_size, :data, :alt])
    |> validate_required([:filename, :content_type, :byte_size, :data])
    |> validate_inclusion(:content_type, @types)
    |> validate_number(:byte_size, greater_than: 0, less_than_or_equal_to: @max_bytes)
    |> validate_length(:filename, max: 255)
    |> validate_length(:alt, max: 255)
    |> check_constraint(:content_type, name: :allowed_type)
    |> check_constraint(:byte_size, name: :size_limit)
  end
end
