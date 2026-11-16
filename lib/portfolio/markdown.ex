defmodule Portfolio.Markdown do
  @moduledoc """
  A small, safe Markdown renderer for posts and the profile.

  Safety model: every piece of text is HTML-escaped first, and only
  then are our own tags added. Raw HTML in a post is shown as text,
  never executed. Links are allowed only to http(s), mailto and
  site-relative ("/...") addresses.

  Supported:
    blank line         new paragraph
    # / ## / ###       headings (rendered as h2/h3/h4; the page title is h1)
    **bold**, *italic*, `code`
    [text](https://...)
    ![description](/media/12)   image (from Admin → Images)
    > quote            (quote lines can contain paragraphs and formatting)
    - item / * item    bulleted list
    1. item            numbered list
    ```                fenced code block
    --- / ***          section break
  """

  @doc "Markdown text -> HTML string (already escaped and safe to embed)."
  def to_html(nil), do: ""

  def to_html(text) when is_binary(text) do
    text
    |> String.replace(~r/\r\n?/, "\n")
    |> String.split("\n")
    |> blocks([])
    |> Enum.join("\n")
  end

  ## Blocks

  defp blocks([], acc), do: Enum.reverse(acc)

  defp blocks([line | rest] = lines, acc) do
    cond do
      blank?(line) ->
        blocks(rest, acc)

      String.starts_with?(String.trim_leading(line), "```") ->
        {code, rest} = Enum.split_while(rest, &(not String.starts_with?(String.trim_leading(&1), "```")))
        html = "<pre><code>" <> esc(Enum.join(code, "\n")) <> "</code></pre>"
        blocks(Enum.drop(rest, 1), [html | acc])

      m = Regex.run(~r/^\s{0,3}(\#{1,6})\s+(.+?)\s*#*\s*$/, line) ->
        [_, hashes, title] = m
        level = hashes |> String.length() |> Kernel.+(1) |> min(4)
        blocks(rest, ["<h#{level}>#{inline(title)}</h#{level}>" | acc])

      Regex.match?(~r/^\s{0,3}([-*_])(\s*\1){2,}\s*$/, line) ->
        blocks(rest, ["<hr>" | acc])

      quote_line?(line) ->
        {quoted, rest} = Enum.split_while(lines, &quote_line?/1)
        inner = quoted |> Enum.map(&String.replace(&1, ~r/^\s{0,3}>\s?/, "")) |> blocks([])
        blocks(rest, ["<blockquote>" <> Enum.join(inner, "\n") <> "</blockquote>" | acc])

      bullet?(line) ->
        {items, rest} = Enum.split_while(lines, &bullet?/1)
        blocks(rest, [list("ul", items, ~r/^\s{0,3}[-*+]\s+/) | acc])

      numbered?(line) ->
        {items, rest} = Enum.split_while(lines, &numbered?/1)
        blocks(rest, [list("ol", items, ~r/^\s{0,3}\d{1,9}[.)]\s+/) | acc])

      true ->
        {para, rest} = Enum.split_while(lines, &paragraph_line?/1)
        text = para |> Enum.map(&String.trim/1) |> Enum.join(" ")
        blocks(rest, ["<p>" <> inline(text) <> "</p>" | acc])
    end
  end

  defp list(tag, items, marker) do
    lis = Enum.map_join(items, "", fn item -> "<li>" <> inline(String.replace(item, marker, "")) <> "</li>" end)
    "<#{tag}>" <> lis <> "</#{tag}>"
  end

  defp blank?(line), do: String.trim(line) == ""
  defp quote_line?(line), do: Regex.match?(~r/^\s{0,3}>/, line)
  defp bullet?(line), do: Regex.match?(~r/^\s{0,3}[-*+]\s+\S/, line) and not hr?(line)
  defp numbered?(line), do: Regex.match?(~r/^\s{0,3}\d{1,9}[.)]\s+\S/, line)
  defp hr?(line), do: Regex.match?(~r/^\s{0,3}([-*_])(\s*\1){2,}\s*$/, line)

  defp paragraph_line?(line) do
    not blank?(line) and not quote_line?(line) and not bullet?(line) and not numbered?(line) and
      not hr?(line) and not Regex.match?(~r/^\s{0,3}(\#{1,6}\s|```)/, line)
  end

  ## Inline

  # Split on backticks so code spans are escaped but never formatted.
  # With an odd number of backticks, the last one is a literal character.
  defp inline(text) do
    parts = String.split(text, "`")

    {parts, tail} =
      if rem(length(parts), 2) == 0,
        do: {Enum.drop(parts, -1), "`" <> List.last(parts)},
        else: {parts, ""}

    body =
      parts
      |> Enum.with_index()
      |> Enum.map_join(fn
        {code, i} when rem(i, 2) == 1 -> "<code>" <> esc(code) <> "</code>"
        {plain, _} -> plain_inline(plain)
      end)

    body <> plain_inline(tail)
  end

  defp plain_inline(text), do: text |> esc() |> images() |> links() |> emphasis()

  # ![description](/media/12) or ![description](https://...). Runs on
  # escaped text and before links(), which would otherwise take the
  # "[...](...)" part.
  defp images(escaped) do
    Regex.replace(
      ~r{!\[([^\]]*)\]\(((?:https://|/)[^\s()]*)\)},
      escaped,
      fn _, alt, url -> ~s(<img src="#{url}" alt="#{alt}" loading="lazy">) end
    )
  end

  # Runs on already-escaped text, so `"` is &quot; and cannot break out of href.
  defp links(escaped) do
    Regex.replace(
      ~r{\[([^\]]+)\]\(((?:https?://|mailto:|/)[^\s()]*)\)},
      escaped,
      fn _, label, url ->
        rel = if String.starts_with?(url, "/"), do: "", else: ~s( rel="noopener")
        ~s(<a href="#{url}"#{rel}>#{label}</a>)
      end
    )
  end

  defp emphasis(text) do
    text
    |> then(&Regex.replace(~r/\*\*(?=\S)(.+?)(?<=\S)\*\*/, &1, "<strong>\\1</strong>"))
    |> then(&Regex.replace(~r/(?<![*\w])\*(?=\S)(.+?)(?<=\S)\*(?![*\w])/, &1, "<em>\\1</em>"))
  end

  defp esc(text), do: text |> Phoenix.HTML.html_escape() |> Phoenix.HTML.safe_to_string()
end
