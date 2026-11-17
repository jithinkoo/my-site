defmodule PortfolioWeb.Admin.JargonController do
  use PortfolioWeb, :controller

  alias Portfolio.Glossary
  alias Portfolio.Glossary.Jargon

  def index(conn, _params) do
    render(conn, :index, terms: Glossary.list(), page_title: "Jargon")
  end

  def new(conn, _params) do
    render(conn, :new, form: to_form(Glossary.change(%Jargon{})), page_title: "New term")
  end

  def create(conn, %{"jargon" => params}) do
    case Glossary.create(params) do
      {:ok, _} ->
        conn
        |> put_flash(:info, "Term added.")
        |> redirect(to: ~p"/admin/jargon")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:new, form: to_form(changeset), page_title: "New term")
    end
  end

  def edit(conn, %{"id" => id}) do
    term = Glossary.get!(id)
    render(conn, :edit, term: term, form: to_form(Glossary.change(term)), page_title: term.term)
  end

  def update(conn, %{"id" => id, "jargon" => params}) do
    term = Glossary.get!(id)

    case Glossary.update(term, params) do
      {:ok, _} ->
        conn
        |> put_flash(:info, "Term saved.")
        |> redirect(to: ~p"/admin/jargon")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:edit, term: term, form: to_form(changeset), page_title: term.term)
    end
  end

  def delete(conn, %{"id" => id}) do
    {:ok, _} = id |> Glossary.get!() |> Glossary.delete()

    conn
    |> put_flash(:info, "Term deleted.")
    |> redirect(to: ~p"/admin/jargon")
  end
end
