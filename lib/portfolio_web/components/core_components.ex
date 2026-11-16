defmodule PortfolioWeb.CoreComponents do
  @moduledoc """
  Small UI building blocks styled by priv/static/assets/css/app.css.
  No CSS framework, no icon library.
  """
  use Phoenix.Component

  ## Flash messages

  attr :flash, :map, required: true

  def flash_group(assigns) do
    ~H"""
    <div class="flash-group" aria-live="polite">
      <p :if={msg = Phoenix.Flash.get(@flash, :info)} class="flash flash-info" role="status">
        {msg}
      </p>
      <p :if={msg = Phoenix.Flash.get(@flash, :error)} class="flash flash-error" role="alert">
        {msg}
      </p>
    </div>
    """
  end

  ## Form inputs

  attr :field, Phoenix.HTML.FormField, required: true
  attr :label, :string, required: true
  attr :type, :string, default: "text"
  attr :hint, :string, default: nil
  attr :rest, :global, include: ~w(rows placeholder autocomplete required autofocus)

  def input(%{type: "checkbox"} = assigns) do
    assigns = assign(assigns, :checked, Phoenix.HTML.Form.normalize_value("checkbox", assigns.field.value))

    ~H"""
    <div class="field field-check">
      <input type="hidden" name={@field.name} value="false" />
      <label>
        <input type="checkbox" id={@field.id} name={@field.name} value="true" checked={@checked} {@rest} />
        {@label}
      </label>
      <p :if={@hint} class="hint">{@hint}</p>
      <.errors field={@field} />
    </div>
    """
  end

  def input(%{type: "textarea"} = assigns) do
    ~H"""
    <div class="field">
      <label for={@field.id}>{@label}</label>
      <textarea id={@field.id} name={@field.name} {@rest}>{Phoenix.HTML.Form.normalize_value("textarea", @field.value)}</textarea>
      <p :if={@hint} class="hint">{@hint}</p>
      <.errors field={@field} />
    </div>
    """
  end

  def input(assigns) do
    ~H"""
    <div class="field">
      <label for={@field.id}>{@label}</label>
      <input
        type={@type}
        id={@field.id}
        name={@field.name}
        value={Phoenix.HTML.Form.normalize_value(@type, @field.value)}
        {@rest}
      />
      <p :if={@hint} class="hint">{@hint}</p>
      <.errors field={@field} />
    </div>
    """
  end

  attr :field, Phoenix.HTML.FormField, required: true

  defp errors(assigns) do
    # Show errors only after the user has submitted the form.
    errors = if Phoenix.Component.used_input?(assigns.field), do: assigns.field.errors, else: []
    assigns = assign(assigns, :errors, Enum.map(errors, &translate_error/1))

    ~H"""
    <p :for={msg <- @errors} class="field-error">{msg}</p>
    """
  end

  def translate_error({msg, opts}) do
    Enum.reduce(opts, msg, fn {key, value}, acc ->
      String.replace(acc, "%{#{key}}", fn _ -> to_string(value) end)
    end)
  end

  ## Content helpers

  @doc "Renders Markdown to HTML. All text is escaped first (see Portfolio.Markdown)."
  def markdown(text) do
    text |> Portfolio.Markdown.to_html() |> Phoenix.HTML.raw()
  end

  @doc "16 November 2026"
  def long_date(nil), do: ""
  def long_date(%DateTime{} = dt), do: Calendar.strftime(dt, "%-d %B %Y")

  @doc "16 Nov 2026"
  def short_date(nil), do: ""
  def short_date(%DateTime{} = dt), do: Calendar.strftime(dt, "%-d %b %Y")
end
