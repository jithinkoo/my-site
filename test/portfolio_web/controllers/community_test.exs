defmodule PortfolioWeb.CommunityTest do
  # Not async: the comment rate limiter is shared in-memory state.
  use PortfolioWeb.ConnCase, async: false

  alias Portfolio.{Blog, Media, RateLimiter}

  @png Base.decode64!(
         "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
       )

  setup do
    RateLimiter.reset()

    {:ok, post} =
      Blog.create_post(%{
        title: "Heroes",
        body: String.duplicate("Why do we need heroes in our lives? ", 20),
        published: true
      })

    %{post: post}
  end

  defp upload(bytes, filename) do
    path = Path.join(System.tmp_dir!(), "upload-#{System.unique_integer([:positive])}")
    File.write!(path, bytes)
    on_exit(fn -> File.rm(path) end)
    %Plug.Upload{path: path, filename: filename, content_type: "image/png"}
  end

  defp base, do: PortfolioWeb.Endpoint.url()

  defp log_in(conn) do
    conn |> post(~p"/admin/login", password: "test-password-123") |> recycle()
  end

  describe "comments" do
    test "a visitor's comment shows under the post right away", %{conn: conn, post: post} do
      conn =
        post(conn, ~p"/thoughts/heroes/comments",
          comment: %{name: "  Asha   R ", body: "Lovely thought.\nMy hero was my teacher."}
        )

      assert redirected_to(conn) == "/thoughts/heroes#comments"

      html = build_conn() |> get(~p"/thoughts/heroes") |> html_response(200)
      assert html =~ "1 comment"
      assert html =~ "Asha R"
      assert html =~ "My hero was my teacher."
      assert [%{name: "Asha R"}] = Blog.list_comments(post)
    end

    test "comments are shown as plain text, never as HTML", %{conn: conn} do
      post(conn, ~p"/thoughts/heroes/comments",
        comment: %{name: "<b>x</b>", body: "<script>alert(1)</script> [link](https://spam.example)"}
      )

      html = build_conn() |> get(~p"/thoughts/heroes") |> html_response(200)
      refute html =~ "<script>alert(1)"
      assert html =~ "&lt;script&gt;alert(1)&lt;/script&gt;"
      refute html =~ ~s(href="https://spam.example")
    end

    test "empty or too long comments are refused with a message", %{conn: conn} do
      conn = post(conn, ~p"/thoughts/heroes/comments", comment: %{name: "", body: ""})
      assert html_response(conn, 422) =~ "please fill this in"

      conn = post(build_conn(), ~p"/thoughts/heroes/comments",
        comment: %{name: "A", body: String.duplicate("x", 1001)})

      assert html_response(conn, 422) =~ "should be at most 1000"
    end

    test "the hidden spam trap silently drops bot comments", %{conn: conn, post: post} do
      conn =
        post(conn, ~p"/thoughts/heroes/comments",
          comment: %{name: "Bot", body: "buy now", website: "http://spam"}
        )

      assert redirected_to(conn) == "/thoughts/heroes#comments"
      assert Blog.list_comments(post) == []
    end

    test "one visitor can't flood a post", %{post: post} do
      for i <- 1..3 do
        build_conn()
        |> put_req_header("x-forwarded-for", "203.0.113.9")
        |> post(~p"/thoughts/heroes/comments", comment: %{name: "N#{i}", body: "hi"})
      end

      conn =
        build_conn()
        |> put_req_header("x-forwarded-for", "203.0.113.9")
        |> post(~p"/thoughts/heroes/comments", comment: %{name: "N4", body: "again"})

      assert html_response(conn, 429) =~ "wait a few minutes"
      assert length(Blog.list_comments(post)) == 3

      # someone else can still comment
      build_conn()
      |> put_req_header("x-forwarded-for", "198.51.100.7")
      |> post(~p"/thoughts/heroes/comments", comment: %{name: "Other", body: "hello"})

      assert length(Blog.list_comments(post)) == 4
    end

    test "drafts can't be commented on", %{conn: conn} do
      {:ok, _} = Blog.create_post(%{title: "Secret draft", body: "x"})
      conn = post(conn, ~p"/thoughts/secret-draft/comments", comment: %{name: "A", body: "b"})
      assert html_response(conn, 404)
    end

    test "only the admin sees and can use the delete button", %{conn: conn, post: post} do
      {:ok, comment} = Blog.create_comment(post, %{name: "Spammer", body: "junk"})

      refute build_conn() |> get(~p"/thoughts/heroes") |> html_response(200) =~ "Delete comment"
      assert build_conn() |> delete(~p"/admin/comments/#{comment.id}") |> redirected_to() == ~p"/admin/login"
      assert length(Blog.list_comments(post)) == 1

      conn = log_in(conn)
      assert conn |> get(~p"/thoughts/heroes") |> html_response(200) =~ "Delete comment"

      conn =
        conn
        |> recycle()
        |> put_req_header("referer", "https://example.com/thoughts/heroes")
        |> delete(~p"/admin/comments/#{comment.id}")

      assert redirected_to(conn) == "/thoughts/heroes#comments"
      assert Blog.list_comments(post) == []
    end

    test "comment counts appear in the lists", %{post: post} do
      {:ok, _} = Blog.create_comment(post, %{name: "A", body: "b"})
      {:ok, _} = Blog.create_comment(post, %{name: "C", body: "d"})
      assert build_conn() |> get(~p"/thoughts") |> html_response(200) =~ "2 comments"
    end
  end

  describe "read more" do
    test "lists show the opening lines ending in … and a Read more link" do
      html = build_conn() |> get(~p"/thoughts") |> html_response(200)
      assert html =~ "Why do we need heroes in our lives?"
      assert html =~ "…"
      assert html =~ "Read more"
      assert html =~ ~s(href="/thoughts/heroes")
    end

    test "excerpt prefers the summary and strips markdown" do
      assert Blog.excerpt(%Blog.Post{summary: "Short.", body: "long"}) == "Short."

      text = Blog.excerpt(%Blog.Post{body: "## Title\n\n**Bold** and [a link](https://x.y) ![img](/media/1)"})
      assert text == "Title Bold and a link"
    end
  end

  describe "gallery" do
    test "only gallery photos show, with caption and place", %{conn: conn} do
      conn = log_in(conn)

      post(conn, ~p"/admin/images",
        image: %{files: [upload(@png, "temple.png")], alt: "Big temple", gallery: "true", place: "Thanjavur"}
      )

      {:ok, _hidden} = Media.create_from_upload(upload(@png, "private.png"))

      html = build_conn() |> get(~p"/gallery") |> html_response(200)
      assert html =~ "Big temple"
      assert html =~ "Thanjavur"
      assert length(Regex.scan(~r/class="gallery-item"/, html)) == 1
    end

    test "caption, place and gallery flag can be edited", %{conn: conn} do
      {:ok, image} = Media.create_from_upload(upload(@png, "a.png"))
      conn = log_in(conn)

      put(conn, ~p"/admin/images/#{image.id}",
        image: %{alt: "Marina at dawn", place: "Chennai", in_gallery: "true"}
      )

      assert [%{alt: "Marina at dawn", place: "Chennai"}] = Media.list_gallery()

      put(recycle(conn), ~p"/admin/images/#{image.id}", image: %{in_gallery: "false"})
      assert Media.list_gallery() == []
    end

    test "Gallery is in the menu after About and Thoughts" do
      html = build_conn() |> get(~p"/") |> html_response(200)
      [nav] = Regex.run(~r{<nav aria-label="Main">.*?</nav>}s, html)
      assert Regex.scan(~r{>(About|Thoughts|Gallery)</a>}, nav, capture: :all_but_first) ==
               [["About"], ["Thoughts"], ["Gallery"]]
    end
  end

  describe "post cover image" do
    test "upload, show on post and list, use for sharing, then remove", %{conn: conn, post: post} do
      conn = log_in(conn)

      put(conn, ~p"/admin/posts/#{post.id}", post: %{cover: upload(@png, "cover.png")})
      cover = Blog.get_post!(post.id).cover_image_id
      assert is_integer(cover)

      page = build_conn() |> get(~p"/thoughts/heroes") |> html_response(200)
      assert page =~ ~s(class="post-cover")
      assert page =~ ~s(property="og:image" content="#{base()}/media/#{cover}")
      assert build_conn() |> get(~p"/thoughts") |> html_response(200) =~ ~s(class="post-thumb")

      put(recycle(conn), ~p"/admin/posts/#{post.id}", post: %{remove_cover: "true"})
      assert Blog.get_post!(post.id).cover_image_id == nil
    end

    test "the cover id can't be set directly from the form", %{conn: conn, post: post} do
      {:ok, image} = Media.create_from_upload(upload(@png, "x.png"))
      put(log_in(conn), ~p"/admin/posts/#{post.id}", post: %{cover_image_id: image.id})
      assert Blog.get_post!(post.id).cover_image_id == nil
    end
  end

  describe "search engines" do
    test "sitemap lists public pages and posts, not drafts" do
      {:ok, _} = Blog.create_post(%{title: "Hidden draft", body: "x"})
      conn = build_conn() |> get(~p"/sitemap.xml")
      xml = response(conn, 200)
      assert response_content_type(conn, :xml) =~ "xml"
      assert xml =~ "<loc>#{base()}/</loc>"
      assert xml =~ "<loc>#{base()}/about</loc>"
      assert xml =~ "<loc>#{base()}/thoughts/heroes</loc>"
      refute xml =~ "hidden-draft"
    end

    test "robots.txt allows the site, blocks admin, points to the sitemap" do
      body = build_conn() |> get("/robots.txt") |> response(200)
      assert body =~ "Disallow: /admin"
      assert body =~ "Sitemap: #{base()}/sitemap.xml"
    end

    test "pages carry canonical URL and structured data" do
      html = build_conn() |> get(~p"/thoughts/heroes") |> html_response(200)
      assert html =~ ~s(<link rel="canonical" href="#{base()}/thoughts/heroes">)
      [json] = Regex.run(~r{<script type="application/ld\+json">\s*(.*?)\s*</script>}s, html, capture: :all_but_first)
      data = Jason.decode!(json)
      types = Enum.map(data["@graph"], & &1["@type"])
      assert "Person" in types
      assert "BlogPosting" in types
    end

    test "Google verification tag appears only when configured" do
      refute build_conn() |> get(~p"/") |> html_response(200) =~ "google-site-verification"

      Application.put_env(:portfolio, :google_site_verification, "abc123")
      on_exit(fn -> Application.delete_env(:portfolio, :google_site_verification) end)

      assert build_conn() |> get(~p"/") |> html_response(200) =~
               ~s(<meta name="google-site-verification" content="abc123">)
    end

    test "admin pages stay out of search results" do
      html = build_conn() |> get(~p"/admin/login") |> html_response(200)
      assert html =~ ~s(name="robots" content="noindex, nofollow")
      refute html =~ "application/ld+json"
    end
  end
end
