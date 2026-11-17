defmodule PortfolioWeb.Admin.QuestionController do
  use PortfolioWeb, :controller

  alias Portfolio.Quiz
  alias Portfolio.Quiz.Question

  def index(conn, _params) do
    render(conn, :index,
      questions: Quiz.list_questions(),
      scores: Quiz.recent_scores(),
      high: Quiz.high_score(),
      page_title: "Quiz"
    )
  end

  def new(conn, _params) do
    render(conn, :new, form: to_form(Quiz.change_question(%Question{})), page_title: "New question")
  end

  def create(conn, %{"question" => params}) do
    case Quiz.create_question(params) do
      {:ok, _} ->
        conn
        |> put_flash(:info, "Question added.")
        |> redirect(to: ~p"/admin/questions")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:new, form: to_form(changeset), page_title: "New question")
    end
  end

  def edit(conn, %{"id" => id}) do
    q = Quiz.get_question!(id)
    render(conn, :edit, question: q, form: to_form(Quiz.change_question(q)), page_title: "Edit question")
  end

  def update(conn, %{"id" => id, "question" => params}) do
    q = Quiz.get_question!(id)

    case Quiz.update_question(q, params) do
      {:ok, _} ->
        conn
        |> put_flash(:info, "Question saved.")
        |> redirect(to: ~p"/admin/questions")

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:edit, question: q, form: to_form(changeset), page_title: "Edit question")
    end
  end

  def delete(conn, %{"id" => id}) do
    {:ok, _} = id |> Quiz.get_question!() |> Quiz.delete_question()

    conn
    |> put_flash(:info, "Question deleted.")
    |> redirect(to: ~p"/admin/questions")
  end

  def delete_score(conn, %{"id" => id}) do
    _ = Quiz.delete_score(id)

    conn
    |> put_flash(:info, "Score deleted.")
    |> redirect(to: ~p"/admin/questions")
  end
end
