defmodule PortfolioWeb.HealthController do
  @moduledoc """
  GET /health answers "ok" without touching the database or the session.

  An uptime monitor pings it every few minutes so the free Render service
  never falls asleep (no "waking up" screen for visitors), while the free
  Neon database can still sleep when nobody is reading the site.
  """
  use PortfolioWeb, :controller

  def show(conn, _params) do
    conn
    |> put_resp_content_type("text/plain")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(200, "ok")
  end
end
