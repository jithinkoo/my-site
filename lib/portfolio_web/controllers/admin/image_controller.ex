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

      {saved, errors} =
        Enum.reduce(uploads, {0, []}, fn upload, {saved, errors} ->
          case Media.create_from_upload(upload, params["alt"]) do
            {:ok, image} ->
              if slideshow?, do: :ok = Media.set_slideshow(image.id, true)
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
