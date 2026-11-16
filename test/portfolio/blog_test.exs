defmodule Portfolio.BlogTest do
  use Portfolio.DataCase, async: true

  alias Portfolio.Blog
  alias Portfolio.Blog.Post

  test "slug is built from the title when left empty" do
    {:ok, post} = Blog.create_post(%{title: "Hello, World! Ça va?", body: "x"})
    assert post.slug == "hello-world-ca-va"
  end

  test "custom slug is cleaned up" do
    {:ok, post} = Blog.create_post(%{title: "T", slug: "My  Custom Slug!", body: "x"})
    assert post.slug == "my-custom-slug"
  end

  test "slugs are unique" do
    {:ok, _} = Blog.create_post(%{title: "Same", body: "x"})
    assert {:error, cs} = Blog.create_post(%{title: "Same", body: "y"})
    assert "has already been taken" in errors_on(cs).slug
  end

  test "publishing stamps published_at once and keeps it" do
    {:ok, draft} = Blog.create_post(%{title: "Draft", body: "x"})
    assert draft.published_at == nil

    {:ok, live} = Blog.update_post(draft, %{published: true})
    assert %DateTime{} = live.published_at

    {:ok, hidden} = Blog.update_post(live, %{published: false})
    {:ok, again} = Blog.update_post(hidden, %{published: true})
    assert again.published_at == live.published_at
  end

  test "drafts are hidden from public lists and lookups" do
    {:ok, _} = Blog.create_post(%{title: "Secret", body: "x"})
    {:ok, _} = Blog.create_post(%{title: "Public", body: "x", published: true})

    assert [%Post{title: "Public"}] = Blog.list_published_posts()
    assert Blog.get_published_post_by_slug("secret") == nil
  end

  test "database rejects a published post without a date" do
    assert_raise Postgrex.Error, ~r/published_needs_date/, fn ->
      Repo.insert_all("posts", [
        %{
          title: "t",
          slug: "t",
          body: "b",
          published: true,
          published_at: nil,
          inserted_at: DateTime.utc_now(:second),
          updated_at: DateTime.utc_now(:second)
        }
      ])
    end
  end

  test "reading time" do
    body = String.duplicate("word ", 450)
    assert Blog.reading_minutes(%Post{body: body}) == 3
    assert Blog.reading_minutes(%Post{body: ""}) == 1
  end
end
