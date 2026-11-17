defmodule PortfolioWeb.QuizController do
  @moduledoc """
  JSON endpoints for the home page quiz. The run is kept in the signed
  session cookie; answers are checked here, never in the browser.
  """
  use PortfolioWeb, :controller

  alias Portfolio.{Quiz, RateLimiter}

  @session_key :quiz

  # GET /quiz/state — resume a run after a reload (the timer keeps going).
  def state(conn, _params) do
    case get_session(conn, @session_key) do
      nil -> json(conn, %{phase: "idle", high: high_json(), count: Quiz.active_question_count()})
      run -> json(conn, payload(run, now()))
    end
  end

  # POST /quiz/start
  def start(conn, _params) do
    if RateLimiter.hit({:quiz, visitor_key(conn)}, 30, 10 * 60 * 1000) == :ok do
      run = Quiz.new_run(now())

      conn
      |> put_session(@session_key, run)
      |> json(payload(run, now()))
    else
      conn
      |> put_status(:too_many_requests)
      |> json(%{error: "Too many games just now. Please try again in a few minutes."})
    end
  end

  # POST /quiz/answer  {"choice": "a" | "b"}
  def answer(conn, %{"choice" => choice}) do
    with run when is_map(run) <- get_session(conn, @session_key),
         {:ok, run, result} <- Quiz.answer(run, choice) do
      {run, new_high?} = Quiz.save_if_done(run, now())

      conn
      |> put_session(@session_key, run)
      |> json(Map.merge(payload(run, now()), %{result: result, new_high: new_high?}))
    else
      _ -> conn |> put_status(:conflict) |> json(%{error: "No question to answer. Start a new quiz."})
    end
  end

  def answer(conn, _params), do: conn |> put_status(:bad_request) |> json(%{error: "Choose A or B."})

  # POST /quiz/name  {"name": "..."} — the fixed 4th step.
  def name(conn, params) do
    case get_session(conn, @session_key) do
      %{"phase" => "name"} = run ->
        run = Quiz.give_name(run, params["name"])
        {run, new_high?} = Quiz.save_if_done(run, now())

        conn
        |> put_session(@session_key, run)
        |> json(Map.put(payload(run, now()), :new_high, new_high?))

      _ ->
        conn |> put_status(:conflict) |> json(%{error: "Not asking for a name right now."})
    end
  end

  defp payload(run, now) do
    question = Quiz.current_question(run)
    total = length(run["ids"])

    %{
      phase: run["phase"],
      question:
        question &&
          %{text: question.text, a: question.option_a, b: question.option_b, number: run["i"] + 1, total: total},
      score: run["score"],
      streak: run["streak"],
      best_streak: run["best_streak"],
      correct: run["correct"],
      answered: run["i"],
      total: total,
      name: run["name"],
      elapsed_ms: max(0, now - run["started"]),
      high: high_json()
    }
  end

  defp high_json do
    case Quiz.high_score() do
      nil -> nil
      s -> %{name: s.name, score: s.score, duration_ms: s.duration_ms}
    end
  end

  defp now, do: System.system_time(:millisecond)

  defp visitor_key(conn) do
    case get_req_header(conn, "x-forwarded-for") do
      [forwarded | _] -> forwarded |> String.split(",") |> hd() |> String.trim()
      [] -> conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end
end
