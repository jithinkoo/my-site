defmodule PortfolioWeb.QuizTest do
  use PortfolioWeb.ConnCase, async: false

  alias Portfolio.{Quiz, RateLimiter}

  setup do
    RateLimiter.reset()
    :ok
  end

  defp add_questions(n) do
    for i <- 1..n do
      {:ok, q} =
        Quiz.create_question(%{
          text: "Question #{i}?",
          option_a: "A#{i}",
          option_b: "B#{i}",
          correct: if(rem(i, 2) == 0, do: "b", else: "a")
        })

      q
    end
  end

  defp json_post(conn, path, body \\ %{}) do
    conn = conn |> recycle() |> put_req_header("accept", "application/json") |> post(path, body)
    {conn, Jason.decode!(conn.resp_body)}
  end

  defp correct_choice(%{"question" => %{"text" => text}}) do
    Enum.find(Quiz.list_questions(), &(&1.text == text)).correct
  end

  defp wrong_choice(payload), do: if(correct_choice(payload) == "a", do: "b", else: "a")

  # Plays a whole run, answering correctly `right` times (first), giving `name`.
  defp play(conn, right, name) do
    {conn, data} = json_post(conn, ~p"/quiz/start")
    do_play(conn, data, right, name)
  end

  defp do_play(conn, %{"phase" => "done"} = data, _right, _name), do: {conn, data}

  defp do_play(conn, %{"phase" => "name"}, right, name) do
    {conn, data} = json_post(conn, ~p"/quiz/name", %{name: name})
    do_play(conn, data, right, name)
  end

  defp do_play(conn, %{"phase" => "question"} = data, right, name) do
    choice = if right > 0, do: correct_choice(data), else: wrong_choice(data)
    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: choice})
    do_play(conn, data, right - 1, name)
  end

  test "no questions yet", %{conn: conn} do
    data = conn |> put_req_header("accept", "application/json") |> get(~p"/quiz/state") |> json_response(200)
    assert data["phase"] == "idle"
    assert data["count"] == 0

    {_conn, data} = json_post(build_conn(), ~p"/quiz/start")
    assert data["phase"] == "empty"
  end

  test "the full flow: 3 questions, then the name, then the rest", %{conn: conn} do
    add_questions(5)
    {conn, data} = json_post(conn, ~p"/quiz/start")
    assert data["phase"] == "question"
    assert data["question"]["number"] == 1
    assert data["total"] == 5
    refute Map.has_key?(data["question"], "correct")

    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    assert data["result"]["correct"]
    assert data["result"]["gained"] == 10
    assert data["score"] == 10

    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    assert data["streak"] == 3
    assert data["score"] == 30
    assert data["phase"] == "name"
    assert data["question"] == nil

    {conn, data} = json_post(conn, ~p"/quiz/name", %{name: "  Asha   R "})
    assert data["phase"] == "question"
    assert data["question"]["number"] == 4
    assert data["name"] == "Asha R"

    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: wrong_choice(data)})
    refute data["result"]["correct"]
    assert data["streak"] == 0
    assert data["score"] == 30

    {_conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    assert data["phase"] == "done"
    assert data["score"] == 40
    assert data["new_high"]
    assert data["high"] == %{"name" => "Asha R", "score" => 40, "duration_ms" => data["high"]["duration_ms"]}

    assert [%{name: "Asha R", score: 40, correct_count: 4}] = Quiz.recent_scores()
  end

  test "with fewer than 3 questions the name is asked at the end", %{conn: conn} do
    add_questions(2)
    {conn, data} = json_post(conn, ~p"/quiz/start")
    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    assert data["phase"] == "name"
    {_conn, data} = json_post(conn, ~p"/quiz/name", %{name: ""})
    assert data["phase"] == "done"
    assert [%{name: "Anonymous", score: 20}] = Quiz.recent_scores()
  end

  test "the high score is shown to everyone and taken over by a better run" do
    add_questions(5)
    {_c, first} = play(build_conn(), 2, "Asha")
    assert first["new_high"]

    home = build_conn() |> get(~p"/") |> html_response(200)
    assert home =~ "High score <b>20</b> by <b>Asha</b>"

    {_c, lower} = play(build_conn(), 1, "Ravi")
    refute lower["new_high"]
    assert lower["high"]["name"] == "Asha"

    {_c, better} = play(build_conn(), 5, "Meera")
    assert better["new_high"]
    assert build_conn() |> get(~p"/") |> html_response(200) =~ "High score <b>50</b> by <b>Meera</b>"
  end

  test "you can't answer out of turn or invent choices", %{conn: conn} do
    add_questions(4)
    {conn, _} = json_post(conn, ~p"/quiz/name", %{name: "X"})
    assert conn.status == 409

    {conn, data} = json_post(build_conn(), ~p"/quiz/start")
    {conn, _} = json_post(conn, ~p"/quiz/answer", %{choice: "c"})
    assert conn.status == 409

    # answer 3, then try answering instead of giving a name
    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    {conn, data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    {conn, _data} = json_post(conn, ~p"/quiz/answer", %{choice: correct_choice(data)})
    {conn, _} = json_post(conn, ~p"/quiz/answer", %{choice: "a"})
    assert conn.status == 409
  end

  test "a reload resumes the run and the timer keeps counting", %{conn: conn} do
    add_questions(3)
    {conn, _} = json_post(conn, ~p"/quiz/start")
    Process.sleep(30)
    state = conn |> recycle() |> put_req_header("accept", "application/json") |> get(~p"/quiz/state") |> json_response(200)
    assert state["phase"] == "question"
    assert state["elapsed_ms"] >= 30
  end

  test "only active questions are used" do
    [q1 | _] = add_questions(3)
    {:ok, _} = Quiz.update_question(q1, %{active: false})
    {_c, data} = json_post(build_conn(), ~p"/quiz/start")
    assert data["total"] == 2
  end

  describe "admin" do
    defp log_in(conn), do: conn |> post(~p"/admin/login", password: "test-password-123") |> recycle()

    test "questions are managed in admin", %{conn: conn} do
      assert build_conn() |> get(~p"/admin/questions") |> redirected_to() == ~p"/admin/login"

      conn = log_in(conn)

      conn =
        post(conn, ~p"/admin/questions",
          question: %{text: "How many squares are on a chessboard?", option_a: "64", option_b: "32", correct: "a", active: "true"}
        )

      assert redirected_to(conn) == ~p"/admin/questions"
      [q] = Quiz.list_questions()
      assert q.correct == "a"

      put(recycle(conn), ~p"/admin/questions/#{q.id}", question: %{correct: "b"})
      assert [%{correct: "b"}] = Quiz.list_questions()

      delete(recycle(conn), ~p"/admin/questions/#{q.id}")
      assert Quiz.list_questions() == []
    end

    test "a question needs a correct answer", %{conn: conn} do
      conn = log_in(conn)
      conn = post(conn, ~p"/admin/questions", question: %{text: "Q?", option_a: "1", option_b: "2"})
      assert html_response(conn, 422) =~ "please fill this in"
    end

    test "scores can be deleted (e.g. a rude name)", %{conn: conn} do
      add_questions(3)
      play(build_conn(), 3, "Rude name")
      [s] = Quiz.recent_scores()

      assert build_conn() |> delete(~p"/admin/quiz-scores/#{s.id}") |> redirected_to() == ~p"/admin/login"

      conn = log_in(conn)
      assert conn |> get(~p"/admin/questions") |> html_response(200) =~ "Rude name"
      delete(recycle(conn), ~p"/admin/quiz-scores/#{s.id}")
      assert Quiz.recent_scores() == []
    end
  end
end
