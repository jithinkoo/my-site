defmodule PortfolioWeb.ErrorHTMLTest do
  use PortfolioWeb.ConnCase, async: true

  import Phoenix.Template, only: [render_to_string: 4]

  test "renders 404.html" do
    assert render_to_string(PortfolioWeb.ErrorHTML, "404", "html", []) =~ "Page not found"
  end

  test "renders 500.html" do
    assert render_to_string(PortfolioWeb.ErrorHTML, "500", "html", []) =~ "Something went wrong"
  end
end
