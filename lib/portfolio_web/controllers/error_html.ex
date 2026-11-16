defmodule PortfolioWeb.ErrorHTML do
  @moduledoc "Standalone error pages (no database access, so they always render)."
  use PortfolioWeb, :html

  def render(template, _assigns) do
    status = template |> String.split(".") |> hd()

    {heading, text} =
      case status do
        "404" -> {"Page not found", "This page doesn't exist, or it has moved."}
        _ -> {"Something went wrong", "Please try again in a moment."}
      end

    Phoenix.HTML.raw("""
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>#{heading}</title>
        <link rel="stylesheet" href="/assets/css/app.css" />
      </head>
      <body>
        <main class="wrap error-page">
          <p class="eyebrow">#{status}</p>
          <h1>#{heading}</h1>
          <p class="lede">#{text}</p>
          <p><a class="button" href="/">Go home</a></p>
        </main>
      </body>
    </html>
    """)
  end
end
