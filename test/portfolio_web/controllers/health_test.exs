defmodule PortfolioWeb.HealthTest do
  # Not async: the telemetry handler sees queries from every process, so
  # this must not run alongside other tests.
  use PortfolioWeb.ConnCase, async: false

  test "health check answers ok without a database query", %{conn: conn} do
    ref = :telemetry_test.attach_event_handlers(self(), [[:portfolio, :repo, :query]])

    conn = get(conn, ~p"/health")

    assert response(conn, 200) == "ok"
    assert get_resp_header(conn, "cache-control") == ["no-store"]
    refute_received {[:portfolio, :repo, :query], ^ref, _, _}
  end
end
