defmodule Portfolio.Quiz do
  @moduledoc """
  The home page quiz: two-option questions, server-checked answers, and a
  public high score.

  A run lives in the visitor's signed session cookie (question order,
  position, score, streak, start time). Correct answers never leave the
  server until the visitor has chosen, so points can't be faked.
  """

  import Ecto.Query
  alias Portfolio.Repo
  alias Portfolio.Quiz.{Question, Score}

  @points_per_correct 10
  @max_questions 20
  @name_after 3

  def points_per_correct, do: @points_per_correct

  ## Questions (admin)

  def list_questions, do: Question |> order_by(desc: :id) |> Repo.all()
  def get_question!(id), do: Repo.get!(Question, id)
  def get_question(id), do: Repo.get(Question, id)
  def change_question(%Question{} = q, attrs \\ %{}), do: Question.changeset(q, attrs)
  def create_question(attrs), do: %Question{} |> Question.changeset(attrs) |> Repo.insert()
  def update_question(%Question{} = q, attrs), do: q |> Question.changeset(attrs) |> Repo.update()
  def delete_question(%Question{} = q), do: Repo.delete(q)

  def active_question_count do
    Repo.aggregate(from(q in Question, where: q.active), :count)
  end

  ## Scores

  @doc "The best run: highest score, then the fastest, then the earliest."
  def high_score do
    Score
    |> order_by(desc: :score, asc: :duration_ms, asc: :inserted_at)
    |> limit(1)
    |> Repo.one()
  end

  def recent_scores(limit \\ 30) do
    Score |> order_by(desc: :inserted_at) |> limit(^limit) |> Repo.all()
  end

  def delete_score(id) do
    case Repo.get(Score, id) do
      nil -> {:error, :not_found}
      score -> Repo.delete(score)
    end
  end

  ## Runs

  @doc "A fresh run: up to #{@max_questions} active questions in random order."
  def new_run(now_ms) do
    ids =
      from(q in Question, where: q.active, select: q.id)
      |> Repo.all()
      |> Enum.shuffle()
      |> Enum.take(@max_questions)

    %{
      "ids" => ids,
      "i" => 0,
      "score" => 0,
      "streak" => 0,
      "best_streak" => 0,
      "correct" => 0,
      "started" => now_ms,
      "name" => nil,
      "phase" => if(ids == [], do: "empty", else: "question"),
      "saved" => false
    }
  end

  @doc "The question the run is on, without its answer."
  def current_question(%{"phase" => "question", "ids" => ids, "i" => i}) do
    case Enum.at(ids, i) do
      nil -> nil
      id -> get_question(id)
    end
  end

  def current_question(_run), do: nil

  @doc """
  Checks an answer ("a" or "b") for the current question. Returns
  `{:ok, run, %{correct: bool, correct_choice: "a" | "b", gained: n}}`.
  """
  def answer(%{"phase" => "question"} = run, choice) when choice in ["a", "b"] do
    case current_question(run) do
      nil ->
        {:error, :no_question}

      question ->
        correct? = question.correct == choice
        gained = if correct?, do: @points_per_correct, else: 0
        streak = if correct?, do: run["streak"] + 1, else: 0

        run =
          run
          |> Map.merge(%{
            "i" => run["i"] + 1,
            "score" => run["score"] + gained,
            "correct" => run["correct"] + if(correct?, do: 1, else: 0),
            "streak" => streak,
            "best_streak" => max(run["best_streak"], streak)
          })
          |> advance()

        # The explanation is only revealed after a wrong answer.
        explanation = if correct?, do: nil, else: question.explanation

        {:ok, run,
         %{correct: correct?, correct_choice: question.correct, gained: gained, explanation: explanation}}
    end
  end

  def answer(_run, _choice), do: {:error, :not_answering}

  @doc "Records the visitor's name (the fixed 4th step). Blank = Anonymous."
  def give_name(%{"phase" => "name"} = run, name) do
    name =
      name
      |> to_string()
      |> String.split()
      |> Enum.join(" ")
      |> String.slice(0, 40)

    run
    |> Map.put("name", if(name == "", do: "Anonymous", else: name))
    |> Map.put("phase", "question")
    |> advance_after_name()
  end

  def give_name(run, _name), do: run

  # After each answer: ask for the name after the 3rd question (or at the
  # end, if there were fewer), otherwise go on or finish.
  defp advance(run) do
    finished? = run["i"] >= length(run["ids"])

    cond do
      is_nil(run["name"]) and (run["i"] == @name_after or finished?) -> Map.put(run, "phase", "name")
      finished? -> Map.put(run, "phase", "done")
      true -> run
    end
  end

  defp advance_after_name(run) do
    if run["i"] >= length(run["ids"]), do: Map.put(run, "phase", "done"), else: run
  end

  @doc """
  Saves a finished run once. Returns `{run, new_high?}`; `new_high?` is
  true when this run took the top spot.
  """
  def save_if_done(%{"phase" => "done", "saved" => false} = run, now_ms) do
    previous = high_score()

    {:ok, saved} =
      %Score{}
      |> Score.changeset(%{
        name: run["name"] || "Anonymous",
        score: run["score"],
        correct_count: run["correct"],
        duration_ms: max(0, now_ms - run["started"])
      })
      |> Repo.insert()

    new_high? = run["score"] > 0 and (is_nil(previous) or high_score().id == saved.id)
    {Map.put(run, "saved", true), new_high?}
  end

  def save_if_done(run, _now_ms), do: {run, false}
end
