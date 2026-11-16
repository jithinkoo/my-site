defmodule PortfolioWeb.Admin.ImageController do
  use PortfolioWeb, :controller

  alias Portfolio.Media

  def index(conn, _params) do
    render(conn, :index, images: Media.list_images(), page_title: "Images")
  end

  def create(conn, %{"image" => %{"file" => %Plug.Upload{} = upload} = params}) do
    case Media.create_from_upload(upload, params["alt"]) do
      {:ok, _image} ->
        conn
        |> put_flash(:info, "Image uploaded. Copy its line below into any post.")
        |> redirect(to: ~p"/admin/images")

      {:error, message} ->
        conn
        |> put_flash(:error, message)
        |> redirect(to: ~p"/admin/images")
    end
  end

  def create(conn, _params) do
    conn
    |> put_flash(:error, "Please choose an image first.")
    |> redirect(to: ~p"/admin/images")
  end

  def delete(conn, %{"id" => id}) do
    _ = Media.delete_image(id)

    conn
    |> put_flash(:info, "Image deleted.")
    |> redirect(to: ~p"/admin/images")
  end
end
