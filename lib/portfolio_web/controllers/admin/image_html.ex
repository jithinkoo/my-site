defmodule PortfolioWeb.Admin.ImageHTML do
  use PortfolioWeb, :html

  embed_templates "image_html/*"

  def kb(bytes), do: "#{max(1, round(bytes / 1024))} KB"

  def markdown_line(image) do
    "![#{image.alt || "image"}](#{Portfolio.Media.path(image)})"
  end
end
