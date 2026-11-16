defmodule Portfolio.Profiles.Profile do
  use Ecto.Schema
  import Ecto.Changeset

  # Defaults shown until you save your own profile from /admin/profile.
  schema "profiles" do
    field :singleton, :boolean, default: true
    field :name, :string, default: "Your Name"
    field :headline, :string, default: "Software engineer. Writer of small thoughts."

    field :intro, :string,
      default:
        "I have spent six years building software that people use every day. " <>
          "This is where I write down what I notice along the way."

    field :about, :string,
      default: """
      I have been building software for six years, the last two of them mostly in Python.

      Most of my work happens quietly, behind the screens people use: making things reliable, making them simpler, and helping teams ship with confidence.

      Outside of work I think about how people learn, how good teams are built, and the small habits that make long careers enjoyable. This site is where I write those thoughts down.
      """

    field :location, :string, default: "Chennai, India"
    field :email, :string
    field :linkedin_url, :string
    field :github_url, :string
    field :photo_image_id, :id
    field :photo_caption, :string

    timestamps(type: :utc_datetime)
  end

  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :name,
      :headline,
      :intro,
      :about,
      :location,
      :email,
      :linkedin_url,
      :github_url,
      :photo_image_id,
      :photo_caption
    ])
    |> foreign_key_constraint(:photo_image_id)
    |> validate_length(:photo_caption, max: 200)
    |> validate_required([:name, :headline])
    |> validate_length(:name, max: 120)
    |> validate_length(:headline, max: 200)
    |> validate_format(:email, ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "is not a valid email")
    |> validate_url(:linkedin_url)
    |> validate_url(:github_url)
    |> unique_constraint(:singleton)
  end

  defp validate_url(changeset, field) do
    validate_change(changeset, field, fn _, value ->
      case URI.parse(value) do
        %URI{scheme: scheme, host: host} when scheme in ["http", "https"] and is_binary(host) -> []
        _ -> [{field, "must start with https://"}]
      end
    end)
  end
end
