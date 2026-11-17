defmodule PortfolioWeb.Seo do
  @moduledoc """
  Search-engine helpers: page descriptions, canonical URLs, and structured
  data (JSON-LD) so Google understands who the site belongs to and which
  pages are blog posts.
  """

  alias Portfolio.Media

  @doc "Plain-text snippet of at most `max` characters, cut at a word."
  def snippet(nil, _max), do: nil

  def snippet(text, max) do
    text = text |> Portfolio.Markdown.to_plain() |> String.trim()

    cond do
      text == "" -> nil
      String.length(text) <= max -> text
      true -> (text |> String.slice(0, max) |> String.replace(~r/\s+\S*$/u, "")) <> "…"
    end
  end

  @doc "Absolute URL of the current page without query string."
  def canonical_url(conn), do: PortfolioWeb.Endpoint.url() <> conn.request_path

  def absolute(path), do: PortfolioWeb.Endpoint.url() <> path

  @doc """
  JSON-LD for the page: always the site owner (a Person), plus a
  BlogPosting on post pages. Safe to place inside a <script> tag.
  """
  def json_ld(assigns) do
    profile = assigns.profile
    base = PortfolioWeb.Endpoint.url()

    person =
      %{
        "@type" => "Person",
        "@id" => base <> "/#person",
        "name" => profile.name,
        "url" => base <> "/",
        "description" => profile.headline,
        "jobTitle" => "Software Engineer",
        "image" => profile.photo_image_id && absolute(Media.path(profile.photo_image_id)),
        "homeLocation" => profile.location && %{"@type" => "Place", "name" => profile.location},
        "sameAs" => Enum.reject([profile.linkedin_url, profile.github_url], &is_nil/1)
      }
      |> compact()

    graph =
      case assigns[:post] do
        %{} = post ->
          [person, blog_posting(post, base)]

        _ ->
          [person, %{"@type" => "WebSite", "name" => profile.name, "url" => base <> "/"}]
      end

    %{"@context" => "https://schema.org", "@graph" => graph}
    |> Jason.encode!()
    |> String.replace("</", "<\\/")
  end

  defp blog_posting(post, base) do
    %{
      "@type" => "BlogPosting",
      "headline" => post.title,
      "description" => Portfolio.Blog.excerpt(post),
      "datePublished" => post.published_at && DateTime.to_iso8601(post.published_at),
      "dateModified" => DateTime.to_iso8601(post.updated_at),
      "url" => base <> "/thoughts/" <> post.slug,
      "mainEntityOfPage" => base <> "/thoughts/" <> post.slug,
      "image" => post.cover_image_id && absolute(Media.path(post.cover_image_id)),
      "author" => %{"@id" => base <> "/#person"}
    }
    |> compact()
  end

  defp compact(map) do
    map |> Enum.reject(fn {_k, v} -> v in [nil, [], ""] end) |> Map.new()
  end
end
