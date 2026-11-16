defmodule PortfolioWeb.Admin.SessionController do
  use PortfolioWeb, :controller

  alias PortfolioWeb.AdminAuth

  def new(conn, _params) do
    if AdminAuth.admin?(conn) do
      redirect(conn, to: ~p"/admin")
    else
      render(conn, :new, page_title: "Log in")
    end
  end

  def create(conn, %{"password" => password}) do
    if AdminAuth.valid_password?(password) do
      conn
      |> AdminAuth.log_in()
      |> put_flash(:info, "Welcome back.")
      |> redirect(to: ~p"/admin")
    else
      # Slow down password guessing.
      Process.sleep(Application.get_env(:portfolio, :failed_login_delay_ms, 1_000))

      conn
      |> put_status(:unauthorized)
      |> put_flash(:error, "That password didn't work.")
      |> render(:new, page_title: "Log in")
    end
  end

  def create(conn, _params), do: create(conn, %{"password" => ""})

  def delete(conn, _params) do
    conn
    |> AdminAuth.log_out()
    |> redirect(to: ~p"/")
  end
end
