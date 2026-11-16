defmodule PortfolioWeb.Admin.ProfileController do
  use PortfolioWeb, :controller

  alias Portfolio.{Media, Profiles}

  def edit(conn, _params) do
    profile = Profiles.get_profile()
    render(conn, :edit, profile: profile, form: to_form(Profiles.change_profile(profile)), page_title: "Profile")
  end

  def update(conn, %{"profile" => params}) do
    profile = Profiles.get_profile()

    case photo_params(params) do
      {:ok, params} ->
        case Profiles.save_profile(profile, params) do
          {:ok, _profile} ->
            conn
            |> put_flash(:info, "Profile saved.")
            |> redirect(to: ~p"/admin/profile")

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> render(:edit, profile: profile, form: to_form(changeset), page_title: "Profile")
        end

      {:error, message} ->
        changeset = Profiles.change_profile(profile, Map.drop(params, ["photo", "photo_image_id"]))

        conn
        |> put_status(:unprocessable_entity)
        |> put_flash(:error, message)
        |> render(:edit, profile: profile, form: to_form(changeset), page_title: "Profile")
    end
  end

  # The photo id is only ever set from a fresh upload or cleared on request;
  # it is never taken directly from the submitted form.
  defp photo_params(params) do
    params = Map.delete(params, "photo_image_id")

    case params do
      %{"photo" => %Plug.Upload{} = upload} ->
        with {:ok, image} <- Media.create_from_upload(upload, "Photo") do
          {:ok, params |> Map.delete("photo") |> Map.put("photo_image_id", image.id)}
        end

      %{"remove_photo" => "true"} ->
        {:ok, params |> Map.delete("photo") |> Map.put("photo_image_id", nil)}

      _ ->
        {:ok, Map.delete(params, "photo")}
    end
  end
end
