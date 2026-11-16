defmodule Portfolio.Profiles do
  @moduledoc "The single site-owner profile shown across the site."

  alias Portfolio.Repo
  alias Portfolio.Profiles.Profile

  @doc "The saved profile, or an unsaved one with defaults if none exists yet."
  def get_profile do
    Repo.get_by(Profile, singleton: true) || %Profile{}
  end

  def change_profile(%Profile{} = profile, attrs \\ %{}), do: Profile.changeset(profile, attrs)

  @doc "Inserts the profile the first time, updates it afterwards."
  def save_profile(%Profile{} = profile, attrs) do
    profile
    |> Profile.changeset(attrs)
    |> Repo.insert_or_update()
  end
end
