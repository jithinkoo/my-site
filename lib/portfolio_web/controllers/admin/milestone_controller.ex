defmodule PortfolioWeb.Admin.MilestoneController do
  use PortfolioWeb, :controller

  alias Portfolio.Journey
  alias Portfolio.Journey.Milestone

  def index(conn, _params) do
    render(conn, :index,
      goals: Journey.list("goal"),
      achievements: Journey.list("achievement"),
      page_title: "Journey"
    )
  end

  def new(conn, params) do
    kind = if params["kind"] == "achievement", do: "achievement", else: "goal"
    form = to_form(Journey.change(%Milestone{kind: kind}))
    render(conn, :new, form: form, kind: kind, page_title: "New #{kind}")
  end

  def create(conn, %{"milestone" => params}) do
    case Journey.create(params) do
      {:ok, m} ->
        conn
        |> put_flash(:info, "#{label(m.kind)} added.")
        |> redirect(to: ~p"/admin/milestones")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:new, form: to_form(changeset), kind: params["kind"], page_title: "New")
    end
  end

  def edit(conn, %{"id" => id}) do
    m = Journey.get!(id)
    render(conn, :edit, milestone: m, form: to_form(Journey.change(m)), kind: m.kind, page_title: m.title)
  end

  def update(conn, %{"id" => id, "milestone" => params}) do
    m = Journey.get!(id)

    case Journey.update(m, params) do
      {:ok, m} ->
        conn
        |> put_flash(:info, "#{label(m.kind)} saved.")
        |> redirect(to: ~p"/admin/milestones")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:edit, milestone: m, form: to_form(changeset), kind: m.kind, page_title: m.title)
    end
  end

  def delete(conn, %{"id" => id}) do
    {:ok, m} = id |> Journey.get!() |> Journey.delete()

    conn
    |> put_flash(:info, "#{label(m.kind)} deleted.")
    |> redirect(to: ~p"/admin/milestones")
  end

  defp label("goal"), do: "Goal"
  defp label(_), do: "Achievement"
end
