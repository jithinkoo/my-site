defmodule PortfolioWeb.SectionsTest do
  use PortfolioWeb.ConnCase, async: false

  import Portfolio.DataCase, only: [errors_on: 1]
  alias Portfolio.{Blog, Journey, RateLimiter}

  setup do
    RateLimiter.reset()
    :ok
  end

  defp log_in(conn), do: conn |> post(~p"/admin/login", password: "test-password-123") |> recycle()

  defp publish(attrs), do: Blog.create_post(Map.merge(%{body: "Body text.", published: true}, attrs))

  describe "post types and addresses" do
    test "each type lives at its own address and in its own list" do
      {:ok, _} = publish(%{title: "A quiet thought"})
      {:ok, _} = publish(%{title: "The first lesson", kind: "failure"})
      {:ok, _} = publish(%{title: "Shipping Elixir", kind: "success"})
      {:ok, _} = publish(%{title: "Thanjavur", kind: "place", location: "Tamil Nadu", visited_on: ~D[2024-01-14]})

      thoughts = build_conn() |> get(~p"/thoughts") |> html_response(200)
      assert thoughts =~ "A quiet thought"
      refute thoughts =~ "The first lesson"
      refute thoughts =~ "Thanjavur"

      assert build_conn() |> get(~p"/stories/the-first-lesson") |> html_response(200) =~ "Failure story"
      assert build_conn() |> get(~p"/stories/shipping-elixir") |> html_response(200) =~ "Success story"

      place = build_conn() |> get(~p"/places/thanjavur") |> html_response(200)
      assert place =~ "Tamil Nadu"
      assert place =~ "Visited January 2024"
      assert place =~ "All places"
    end

    test "a post opened under the wrong section redirects to the right one" do
      {:ok, _} = publish(%{title: "Marina", kind: "place"})
      assert build_conn() |> get(~p"/thoughts/marina") |> redirected_to() == "/places/marina"
    end

    test "comments work on every type and return to the right page" do
      {:ok, post} = publish(%{title: "Kodaikanal", kind: "place"})

      conn = post(build_conn(), ~p"/posts/kodaikanal/comments", comment: %{name: "R", body: "Lovely place!"})
      assert redirected_to(conn) == "/places/kodaikanal#comments"
      assert [_] = Blog.list_comments(post)
    end

    test "the post editor saves type, location and visit date", %{conn: conn} do
      conn = log_in(conn)

      post(conn, ~p"/admin/posts",
        post: %{title: "Ooty", body: "Hills.", kind: "place", location: "Nilgiris", visited_on: "2023-05-02", published: "true"}
      )

      [p] = Blog.list_published_posts(kind: "place")
      assert {p.location, p.visited_on} == {"Nilgiris", ~D[2023-05-02]}
    end

    test "unknown types are refused" do
      assert {:error, cs} = Blog.create_post(%{title: "X", body: "y", kind: "rant"})
      assert errors_on(cs).kind != []
    end
  end

  describe "places page" do
    test "shows place cards with location and date" do
      {:ok, _} = publish(%{title: "Mahabalipuram", kind: "place", location: "Chengalpattu", visited_on: ~D[2022-12-01]})
      html = build_conn() |> get(~p"/places") |> html_response(200)
      assert html =~ "Mahabalipuram"
      assert html =~ "Chengalpattu"
      assert html =~ "December 2022"
      assert html =~ ~s(class="place-card")
    end
  end

  describe "journey page" do
    test "shows goals with status, achievements, and both kinds of story" do
      {:ok, _} = Journey.create(%{kind: "goal", title: "Run a half marathon", status: "working", when_label: "2027"})
      {:ok, _} = Journey.create(%{kind: "achievement", title: "Five years with Elixir", when_label: "2026"})
      {:ok, _} = publish(%{title: "The first lesson", kind: "failure"})
      {:ok, _} = publish(%{title: "First production release", kind: "success"})

      html = build_conn() |> get(~p"/journey") |> html_response(200)
      assert html =~ "Run a half marathon"
      assert html =~ "Working on it"
      assert html =~ "Five years with Elixir"
      assert html =~ "Success stories"
      assert html =~ "First production release"
      assert html =~ "Failure stories"
      assert html =~ "The first lesson"
    end

    test "empty sections are hidden" do
      html = build_conn() |> get(~p"/journey") |> html_response(200)
      assert html =~ "still being written"
      refute html =~ "Failure stories"
    end

    test "goals and achievements are managed in admin", %{conn: conn} do
      assert build_conn() |> get(~p"/admin/milestones") |> redirected_to() == ~p"/admin/login"

      conn = log_in(conn)
      conn = post(conn, ~p"/admin/milestones", milestone: %{kind: "goal", title: "Visit Ladakh", status: "dreaming"})
      assert redirected_to(conn) == ~p"/admin/milestones"
      [goal] = Journey.list("goal")

      put(recycle(conn), ~p"/admin/milestones/#{goal.id}", milestone: %{status: "done"})
      assert [%{status: "done"}] = Journey.list("goal")

      delete(recycle(conn), ~p"/admin/milestones/#{goal.id}")
      assert Journey.list("goal") == []
    end

    test "bad status values are refused" do
      assert {:error, _} = Journey.create(%{kind: "goal", title: "X", status: "maybe"})
    end
  end

  test "the Jargon section is gone" do
    assert build_conn() |> get("/jargon") |> response(404)
    refute build_conn() |> get(~p"/") |> html_response(200) =~ ~s(href="/jargon")
  end

  describe "sitemap" do
    test "includes the new sections when they have content" do
      {:ok, _} = publish(%{title: "Kanyakumari", kind: "place"})
      {:ok, _} = Journey.create(%{kind: "achievement", title: "First 10k"})

      xml = build_conn() |> get(~p"/sitemap.xml") |> response(200)
      base = PortfolioWeb.Endpoint.url()
      assert xml =~ "<loc>#{base}/places</loc>"
      assert xml =~ "<loc>#{base}/places/kanyakumari</loc>"
      assert xml =~ "<loc>#{base}/journey</loc>"
      refute xml =~ "/jargon"
    end
  end
end
