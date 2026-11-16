defmodule PortfolioWeb.PageController do
  use PortfolioWeb, :controller

  alias Portfolio.Blog

  def home(conn, _params) do
    render(conn, :home, posts: Blog.list_published_posts(limit: 5))
  end

  def about(conn, _params) do
    render(conn, :about, page_title: "About")
  end
end
