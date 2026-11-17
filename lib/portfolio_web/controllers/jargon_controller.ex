defmodule PortfolioWeb.JargonController do
  use PortfolioWeb, :controller

  def index(conn, _params) do
    terms = Portfolio.Glossary.list()

    render(conn, :index,
      terms: terms,
      letters: terms |> Enum.map(&Portfolio.Glossary.letter/1) |> Enum.uniq(),
      page_title: "Jargon, simply explained",
      meta_description: "Tech words and big ideas, explained in plain, everyday language."
    )
  end
end
