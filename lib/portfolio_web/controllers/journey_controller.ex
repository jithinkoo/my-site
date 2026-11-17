defmodule PortfolioWeb.JourneyController do
  use PortfolioWeb, :controller

  alias Portfolio.{Blog, Journey}

  def index(conn, _params) do
    render(conn, :index,
      goals: Journey.list("goal"),
      achievements: Journey.list("achievement"),
      successes: Blog.list_published_posts(kind: "success"),
      failures: Blog.list_published_posts(kind: "failure"),
      page_title: "Journey",
      meta_description: "Goals, achievements, and the stories behind them — the wins and the falls."
    )
  end
end
