defmodule PortfolioWeb.Admin.ProfileController do
  use PortfolioWeb, :controller

  alias Portfolio.Profiles

  def edit(conn, _params) do
    profile = Profiles.get_profile()
    render(conn, :edit, form: to_form(Profiles.change_profile(profile)), page_title: "Profile")
  end

  def update(conn, %{"profile" => params}) do
    case Profiles.save_profile(Profiles.get_profile(), params) do
      {:ok, _profile} ->
        conn
        |> put_flash(:info, "Profile saved.")
        |> redirect(to: ~p"/admin/profile")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:edit, form: to_form(changeset), page_title: "Profile")
    end
  end
end
