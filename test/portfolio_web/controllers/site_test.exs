defmodule PortfolioWeb.SiteTest do
  use PortfolioWeb.ConnCase, async: true

  alias Portfolio.{Blog, Profiles}

  setup do
    {:ok, _} =
      Profiles.save_profile(Profiles.get_profile(), %{
        name: "Asha Menon",
        headline: "Engineer & writer",
        email: "hello@example.com"
      })

    {:ok, live} =
      Blog.create_post(%{title: "On patience", summary: "Short.", body: "**Bold** text", published: true})

    {:ok, draft} = Blog.create_post(%{title: "Unfinished", body: "secret"})
    %{live: live, draft: draft}
  end

  describe "public pages" do
    test "home shows profile and latest posts", %{conn: conn} do
      html = conn |> get(~p"/") |> html_response(200)
      assert html =~ "Asha Menon"
      assert html =~ "Engineer &amp; writer"
      assert html =~ "On patience"
      refute html =~ "Unfinished"
    end

    test "about page", %{conn: conn} do
      html = conn |> get(~p"/about") |> html_response(200)
      assert html =~ "hello@example.com"
    end

    test "post page renders markdown", %{conn: conn} do
      html = conn |> get(~p"/thoughts/on-patience") |> html_response(200)
      assert html =~ "<strong>Bold</strong>"
      assert html =~ "On patience · Asha Menon"
    end

    test "drafts are 404 to the public", %{conn: conn} do
      assert conn |> get(~p"/thoughts/unfinished") |> html_response(404) =~ "Page not found"
    end

    test "RSS feed lists only published posts", %{conn: conn} do
      conn = get(conn, ~p"/feed.xml")
      assert response_content_type(conn, :xml) =~ "rss+xml"
      body = response(conn, 200)
      assert body =~ "<title>On patience</title>"
      refute body =~ "Unfinished"
    end
  end

  describe "admin" do
    test "is locked without login", %{conn: conn} do
      assert conn |> get(~p"/admin") |> redirected_to() == ~p"/admin/login"
      assert conn |> get(~p"/admin/profile") |> redirected_to() == ~p"/admin/login"
      assert conn |> post(~p"/admin/posts", post: %{title: "x", body: "y"}) |> redirected_to() ==
               ~p"/admin/login"
    end

    test "wrong password is rejected", %{conn: conn} do
      conn = post(conn, ~p"/admin/login", password: "nope")
      assert html_response(conn, 401) =~ "didn&#39;t work"
    end

    test "login, write, publish and log out", %{conn: conn} do
      conn = post(conn, ~p"/admin/login", password: "test-password-123")
      assert redirected_to(conn) == ~p"/admin"

      conn = get(recycle(conn), ~p"/admin")
      assert html_response(conn, 200) =~ "Unfinished"

      conn =
        post(recycle(conn), ~p"/admin/posts",
          post: %{title: "A new idea", body: "Hello", published: "true"}
        )

      assert redirected_to(conn) =~ "/admin/posts/"
      assert build_conn() |> get(~p"/thoughts/a-new-idea") |> html_response(200) =~ "A new idea"

      conn = put(recycle(conn), ~p"/admin/profile", profile: %{name: "Asha M."})
      assert redirected_to(conn) == ~p"/admin/profile"
      assert Profiles.get_profile().name == "Asha M."

      conn = delete(recycle(conn), ~p"/admin/logout")
      assert redirected_to(conn) == ~p"/"
      assert conn |> recycle() |> get(~p"/admin") |> redirected_to() == ~p"/admin/login"
    end

    test "admin pages are not indexed", %{conn: conn} do
      conn = get(conn, ~p"/admin/login")
      assert get_resp_header(conn, "x-robots-tag") == ["noindex, nofollow"]
    end
  end
end
