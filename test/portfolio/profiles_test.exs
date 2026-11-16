defmodule Portfolio.ProfilesTest do
  use Portfolio.DataCase, async: true

  alias Portfolio.Profiles

  test "returns defaults before anything is saved" do
    profile = Profiles.get_profile()
    assert profile.id == nil
    assert profile.name == "Your Name"
  end

  test "first save inserts, second save updates the same row" do
    {:ok, first} = Profiles.save_profile(Profiles.get_profile(), %{name: "A", headline: "H"})
    {:ok, second} = Profiles.save_profile(Profiles.get_profile(), %{name: "B"})
    assert first.id == second.id
    assert Profiles.get_profile().name == "B"
  end

  test "database allows only one profile row" do
    {:ok, _} = Profiles.save_profile(Profiles.get_profile(), %{name: "A", headline: "H"})

    assert {:error, cs} =
             Profiles.save_profile(%Portfolio.Profiles.Profile{}, %{name: "B", headline: "H"})

    assert "has already been taken" in errors_on(cs).singleton
  end

  test "links must be http(s)" do
    assert {:error, cs} =
             Profiles.save_profile(Profiles.get_profile(), %{linkedin_url: "javascript:alert(1)"})

    assert errors_on(cs).linkedin_url != []
  end
end
