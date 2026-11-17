defmodule PortfolioWeb.Admin.ProfileController do
  use PortfolioWeb, :controller

  alias Portfolio.{Media, Profiles}

  def edit(conn, _params) do
    profile = Profiles.get_profile()
    render_edit(conn, profile, Profiles.change_profile(profile))
  end

  def update(conn, %{"profile" => params}) do
    profile = Profiles.get_profile()

    with {:ok, params, added} <- background_photos(params),
         {:ok, params} <- photo_params(params) do
      case Profiles.save_profile(profile, params) do
        {:ok, _profile} ->
          conn
          |> put_flash(:info, saved_message(added))
          |> redirect(to: ~p"/admin/profile")

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> render_edit(profile, changeset)
      end
    else
      {:error, message} ->
        changeset =
          Profiles.change_profile(
            profile,
            Map.drop(params, ["photo", "photo_image_id", "background_photos"])
          )

        conn
        |> put_status(:unprocessable_entity)
        |> put_flash(:error, message)
        |> render_edit(profile, changeset)
    end
  end

  defp render_edit(conn, profile, changeset) do
    render(conn, :edit,
      profile: profile,
      form: to_form(changeset),
      background: Media.slideshow_ids(nil),
      page_title: "Profile"
    )
  end

  defp saved_message(0), do: "Profile saved."
  defp saved_message(1), do: "Profile saved. 1 background photo added to the loop."
  defp saved_message(n), do: "Profile saved. #{n} background photos added to the loop."

  # Each chosen background photo is stored and added to the photo loop.
  defp background_photos(params) do
    uploads =
      params
      |> Map.get("background_photos", [])
      |> List.wrap()
      |> Enum.filter(&match?(%Plug.Upload{filename: name} when name not in [nil, ""], &1))

    result =
      Enum.reduce_while(uploads, {:ok, 0}, fn upload, {:ok, count} ->
        case Media.create_from_upload(upload) do
          {:ok, image} ->
            :ok = Media.set_slideshow(image.id, true)
            {:cont, {:ok, count + 1}}

          {:error, message} ->
            {:halt, {:error, "#{upload.filename}: #{message}"}}
        end
      end)

    case result do
      {:ok, count} -> {:ok, Map.delete(params, "background_photos"), count}
      error -> error
    end
  end

  # The photo id is only ever set from a fresh upload or cleared on request;
  # it is never taken directly from the submitted form.
  defp photo_params(params) do
    params = Map.delete(params, "photo_image_id")

    case params do
      %{"photo" => %Plug.Upload{filename: name} = upload} when name not in [nil, ""] ->
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
