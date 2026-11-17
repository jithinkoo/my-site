defmodule PortfolioWeb.JourneyHTML do
  use PortfolioWeb, :html

  embed_templates "journey_html/*"

  def status_class("done"), do: "status status-done"
  def status_class("working"), do: "status status-working"
  def status_class(_), do: "status"
end
