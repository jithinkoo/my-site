defmodule PortfolioWeb.MediaController do
  @moduledoc "Serves uploaded images from the database."
  use PortfolioWeb, :controller

  alias Portfolio.Media

  # Accepts "/media/12" and "/media/12.jpg".
  def show(conn, %{"id" => raw_id}) do
    with {id, _ext} when id > 0 <- Integer.parse(raw_id),
         %Media.Image{} = image <- Media.get_image(id) do
      conn
      |> put_resp_content_type(image.content_type, nil)
      # A new upload always gets a new id, so the bytes behind an id never change.
      |> put_resp_header("cache-control", "public, max-age=31536000, immutable")
      |> put_resp_header("x-content-type-options", "nosniff")
      |> put_resp_header("content-security-policy", "default-src 'none'; sandbox")
      |> send_resp(200, image.data)
    else
      _ -> send_resp(conn, 404, "Not found")
    end
  end
end
