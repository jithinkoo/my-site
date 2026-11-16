defmodule Portfolio.MarkdownTest do
  use ExUnit.Case, async: true

  import Portfolio.Markdown, only: [to_html: 1]

  test "paragraphs, headings, emphasis" do
    html = to_html("# Title\n\nHello **bold** and *soft* words.\nSame paragraph.\n\nNext.")
    assert html =~ "<h2>Title</h2>"
    assert html =~ "<p>Hello <strong>bold</strong> and <em>soft</em> words. Same paragraph.</p>"
    assert html =~ "<p>Next.</p>"
  end

  test "lists, quotes, breaks, code" do
    html = to_html("- one\n- two\n\n1. first\n2. second\n\n> quoted *line*\n\n---\n\n```\na < b\n```")
    assert html =~ "<ul><li>one</li><li>two</li></ul>"
    assert html =~ "<ol><li>first</li><li>second</li></ol>"
    assert html =~ "<blockquote><p>quoted <em>line</em></p></blockquote>"
    assert html =~ "<hr>"
    assert html =~ "<pre><code>a &lt; b</code></pre>"
  end

  test "inline code is escaped and not formatted" do
    assert to_html("use `**x** <b>`") == "<p>use <code>**x** &lt;b&gt;</code></p>"
    assert to_html("a ` b") == "<p>a ` b</p>"
  end

  test "links: safe schemes only" do
    assert to_html("[me](https://example.com/a?b=1&c=2)") ==
             ~s(<p><a href="https://example.com/a?b=1&amp;c=2" rel="noopener">me</a></p>)

    assert to_html("[about](/about)") == ~s(<p><a href="/about">about</a></p>)
    refute to_html("[x](javascript:alert(1))") =~ "<a"
  end

  test "raw HTML is shown as text, never executed" do
    html = to_html("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>")
    refute html =~ "<script"
    refute html =~ "<img"
    assert html =~ "&lt;script&gt;"
  end

  test "link text cannot break out of the attribute" do
    html = to_html(~s{[x](https://e.com/"onmouseover="alert(1))})
    refute html =~ ~s(" onmouseover)
    refute html =~ ~s("onmouseover=")
  end

  test "snake_case and lone asterisks are left alone" do
    assert to_html("my_var_name and 2 * 3 * 4") == "<p>my_var_name and 2 * 3 * 4</p>"
  end
end
