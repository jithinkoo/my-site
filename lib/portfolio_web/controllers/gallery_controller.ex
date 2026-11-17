defmodule PortfolioWeb.GalleryController do
  use PortfolioWeb, :controller

  alias Portfolio.Media

  def index(conn, _params) do
    images = Media.list_gallery()

    render(conn, :index,
      images: images,
      page_title: "Gallery",
      meta_description: "Places and moments, in photographs.",
      meta_image_id: List.first(images) && List.first(images).id
    )
  end
end
