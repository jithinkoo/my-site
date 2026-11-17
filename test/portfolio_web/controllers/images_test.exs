defmodule PortfolioWeb.ImagesTest do
  use PortfolioWeb.ConnCase, async: true

  alias Portfolio.{Media, Profiles}

  @png Base.decode64!(
         "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
       )

  defp upload(bytes, filename) do
    path = Path.join(System.tmp_dir!(), "upload-#{System.unique_integer([:positive])}")
    File.write!(path, bytes)
    on_exit(fn -> File.rm(path) end)
    %Plug.Upload{path: path, filename: filename, content_type: "image/png"}
  end

  defp log_in(conn) do
    conn = post(conn, ~p"/admin/login", password: "test-password-123")
    recycle(conn)
  end

  test "images are served with the right type and long caching", %{conn: conn} do
    {:ok, image} = Media.create_from_upload(upload(@png, "a.png"))
    conn = get(conn, "/media/#{image.id}")
    assert response(conn, 200) == @png
    assert get_resp_header(conn, "content-type") == ["image/png"]
    assert get_resp_header(conn, "cache-control") == ["public, max-age=31536000, immutable"]
    assert get_resp_header(conn, "x-content-type-options") == ["nosniff"]
  end

  test "unknown or bad image ids are 404", %{conn: conn} do
    assert conn |> get("/media/999999") |> response(404)
    assert build_conn() |> get("/media/abc") |> response(404)
  end

  test "image admin is locked without login", %{conn: conn} do
    assert conn |> get(~p"/admin/images") |> redirected_to() == ~p"/admin/login"

    assert build_conn()
           |> post(~p"/admin/images", image: %{file: upload(@png, "a.png")})
           |> redirected_to() == ~p"/admin/login"

    assert Media.list_images() == []
  end

  test "upload from the Images page and use it in a post", %{conn: conn} do
    conn = log_in(conn)
    conn = post(conn, ~p"/admin/images", image: %{file: upload(@png, "beach.png"), alt: "Beach"})
    assert redirected_to(conn) == ~p"/admin/images"

    [image] = Media.list_images()
    html = conn |> recycle() |> get(~p"/admin/images") |> html_response(200)
    assert html =~ "![Beach](/media/#{image.id})"

    {:ok, _} =
      Portfolio.Blog.create_post(%{
        title: "Trip",
        body: "Look:\n\n![Beach](/media/#{image.id})",
        published: true
      })

    post_html = build_conn() |> get(~p"/thoughts/trip") |> html_response(200)
    assert post_html =~ ~s(<img src="/media/#{image.id}" alt="Beach" loading="lazy">)
  end

  test "profile photo shows on home and about pages", %{conn: conn} do
    conn = log_in(conn)

    conn =
      put(conn, ~p"/admin/profile",
        profile: %{name: "Jithin", headline: "Engineer", photo: upload(@png, "me.png")}
      )

    assert redirected_to(conn) == ~p"/admin/profile"
    photo_id = Profiles.get_profile().photo_image_id
    assert is_integer(photo_id)

    home = build_conn() |> get(~p"/") |> html_response(200)
    assert home =~ ~s(src="/media/#{photo_id}")
    assert home =~ ~s(property="og:image")
    assert build_conn() |> get(~p"/about") |> html_response(200) =~ ~s(src="/media/#{photo_id}")

    # Saving without a new file keeps the photo; ticking remove clears it.
    put(recycle(conn), ~p"/admin/profile", profile: %{name: "Jithin K"})
    assert Profiles.get_profile().photo_image_id == photo_id

    put(recycle(conn), ~p"/admin/profile", profile: %{remove_photo: "true"})
    assert Profiles.get_profile().photo_image_id == nil
  end

  test "full-height photo panel with caption, on every public page", %{conn: conn} do
    conn = log_in(conn)

    put(conn, ~p"/admin/profile",
      profile: %{
        name: "Jithin",
        photo_caption: "Curiosity <is> a vector",
        photo: upload(@png, "me.png")
      }
    )

    for path <- [~p"/", ~p"/about", ~p"/thoughts"] do
      html = build_conn() |> get(path) |> html_response(200)
      assert html =~ ~s(class="photo-panel")
      assert html =~ "Curiosity &lt;is&gt; a vector"
    end

    home = build_conn() |> get(~p"/") |> html_response(200)
    assert home =~ "data-physics"
    assert home =~ "/assets/js/site.js"
  end

  test "a dash line in the photo text becomes a signature", %{conn: conn} do
    conn = log_in(conn)

    put(conn, ~p"/admin/profile",
      profile: %{photo_caption: "Born by slow rivers.\r\n-Jithin", photo: upload(@png, "me.png")}
    )

    html = build_conn() |> get(~p"/") |> html_response(200)
    assert html =~ ~r{class="caption-line\s*"[^>]*>\s*Born by slow rivers.\s*</span>}
    assert html =~ ~r{class="caption-line photo-signature"[^>]*>\s*— Jithin\s*</span>}
  end

  test "caption_lines handles dashes, blank lines and plain text" do
    alias PortfolioWeb.Layouts

    assert Layouts.caption_lines("One line") == [{"One line", false}]
    assert Layouts.caption_lines("Quote\n\n— Jithin") == [{"Quote", false}, {"— Jithin", true}]
    assert Layouts.caption_lines("Quote\n--  Jithin ") == [{"Quote", false}, {"— Jithin", true}]
  end

  test "no photo means no panel and a single-column page", %{conn: conn} do
    html = conn |> get(~p"/") |> html_response(200)
    refute html =~ ~s(class="photo-panel")
    refute html =~ "has-photo"
  end

  test "caption longer than 200 characters is refused", %{conn: conn} do
    conn = log_in(conn)
    conn = put(conn, ~p"/admin/profile", profile: %{photo_caption: String.duplicate("a", 201)})
    assert html_response(conn, 422) =~ "should be at most 200"
  end

  test "a non-image profile photo is refused with a message", %{conn: conn} do
    conn = log_in(conn)
    conn = put(conn, ~p"/admin/profile", profile: %{name: "J", photo: upload("not an image", "me.png")})
    assert html_response(conn, 422) =~ "Only JPEG"
    assert Profiles.get_profile().photo_image_id == nil
  end

  test "the photo id can't be set directly from the form", %{conn: conn} do
    {:ok, image} = Media.create_from_upload(upload(@png, "x.png"))
    conn = log_in(conn)
    put(conn, ~p"/admin/profile", profile: %{name: "J", photo_image_id: image.id})
    assert Profiles.get_profile().photo_image_id == nil
  end
end
