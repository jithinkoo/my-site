defmodule PortfolioWeb.Admin.ImageController do
  use PortfolioWeb, :controller

  alias Portfolio.Media

  def index(conn, _params) do
    render(conn, :index, images: Media.list_images(), page_title: "Images")
  end

  # Accepts several files ("files") or a single one ("file").
  def create(conn, %{"image" => params}) do
    uploads =
      [params["files"], params["file"]]
      |> List.flatten()
      |> Enum.filter(&match?(%Plug.Upload{filename: name} when name not in [nil, ""], &1))

    if uploads == [] do
      conn
      |> put_flash(:error, "Please choose an image first.")
      |> redirect(to: ~p"/admin/images")
    else
      slideshow? = params["slideshow"] == "true"
      gallery? = params["gallery"] == "true"

      {saved, errors} =
        Enum.reduce(uploads, {0, []}, fn upload, {saved, errors} ->
          case Media.create_from_upload(upload, params["alt"]) do
            {:ok, image} ->
              if slideshow?, do: :ok = Media.set_slideshow(image.id, true)

              if gallery? or params["place"] not in [nil, ""] do
                {:ok, _} =
                  Media.update_details(image.id, %{
                    "in_gallery" => gallery?,
                    "place" => params["place"]
                  })
              end

              {saved + 1, errors}

            {:error, message} ->
              {saved, errors ++ ["#{upload.filename}: #{message}"]}
          end
        end)

      conn
      |> flash_upload_result(saved, errors, slideshow?)
      |> redirect(to: ~p"/admin/images")
    end
  end

  def create(conn, _params) do
    conn
    |> put_flash(:error, "Please choose an image first.")
    |> redirect(to: ~p"/admin/images")
  end

  defp flash_upload_result(conn, saved, errors, slideshow?) do
    what = if saved == 1, do: "1 image", else: "#{saved} images"
    where = if slideshow?, do: " and added to the background photo loop", else: ""

    conn =
      if saved > 0,
        do: put_flash(conn, :info, "#{what} uploaded#{where}."),
        else: conn

    if errors == [], do: conn, else: put_flash(conn, :error, Enum.join(errors, " "))
  end

  def update(conn, %{"id" => id, "image" => params}) do
    attrs = Map.take(params, ["alt", "place", "in_gallery"])

    case Media.update_details(id, attrs) do
      {:ok, _image} ->
        conn
        |> put_flash(:info, "Photo details saved.")
        |> redirect(to: ~p"/admin/images")

      {:error, :not_found} ->
        conn
        |> put_flash(:error, "That image no longer exists.")
        |> redirect(to: ~p"/admin/images")

      {:error, _changeset} ->
        conn
        |> put_flash(:error, "Caption must be under 255 characters and place under 120.")
        |> redirect(to: ~p"/admin/images")
    end
  end

  def slideshow(conn, %{"id" => id, "in_slideshow" => value}) when value in ["true", "false"] do
    on? = value == "true"

    message =
      case Media.set_slideshow(id, on?) do
        :ok when on? -> {:info, "Added to the background photo loop."}
        :ok -> {:info, "Removed from the background photo loop."}
        {:error, :not_found} -> {:error, "That image no longer exists."}
      end

    {kind, text} = message

    conn
    |> put_flash(kind, text)
    |> redirect(to: ~p"/admin/images")
  end

  def delete(conn, %{"id" => id}) do
    _ = Media.delete_image(id)

    conn
    |> put_flash(:info, "Image deleted.")
    |> redirect(to: ~p"/admin/images")
  end
end
