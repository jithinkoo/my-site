defmodule PortfolioWeb.JargonHTML do
  use PortfolioWeb, :html

  alias Portfolio.Glossary

  embed_templates "jargon_html/*"

  def letter_anchor("#"), do: "letter-other"
  def letter_anchor(letter), do: "letter-" <> String.downcase(letter)

  def anchor(term), do: Glossary.anchor(term)
  def letter(term), do: Glossary.letter(term)
end
