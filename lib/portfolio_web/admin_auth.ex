defmodule PortfolioWeb.AdminAuth do
  @moduledoc """
  Single-owner admin login: one password, set by the ADMIN_PASSWORD
  environment variable in production. No user table, no sign-up.
  """
  import Plug.Conn
  import Phoenix.Controller

  @session_key :admin

  def require_admin(conn, _opts) do
    if admin?(conn) do
      conn
    else
      conn
      |> put_flash(:error, "Please log in.")
      |> redirect(to: "/admin/login")
      |> halt()
    end
  end

  def admin?(conn), do: get_session(conn, @session_key) == true

  @doc "Constant-time check against the configured password."
  def valid_password?(given) when is_binary(given) do
    case Application.get_env(:portfolio, :admin_password) do
      expected when is_binary(expected) and byte_size(expected) >= 8 ->
        Plug.Crypto.secure_compare(
          :crypto.hash(:sha256, given),
          :crypto.hash(:sha256, expected)
        )

      _ ->
        false
    end
  end

  def valid_password?(_), do: false

  def log_in(conn) do
    conn
    |> configure_session(renew: true)
    |> put_session(@session_key, true)
  end

  def log_out(conn), do: configure_session(conn, drop: true)
end
