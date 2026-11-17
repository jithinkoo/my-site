defmodule PortfolioWeb.Admin.JargonHTML do
  use PortfolioWeb, :html

  embed_templates "jargon_html/*"

  attr :form, Phoenix.HTML.Form, required: true
  attr :action, :string, required: true
  attr :method, :string, default: "post"

  def jargon_form(assigns) do
    ~H"""
    <.form for={@form} action={@action} method={@method} class="editor">
      <.input field={@form[:term]} label="Word or phrase" placeholder="e.g. API" maxlength="80" required autofocus />
      <.input
        field={@form[:meaning]}
        label="In one line"
        placeholder="e.g. A menu that one program offers another, so they can ask each other for things."
        maxlength="200"
        required
      />
      <.input
        field={@form[:explanation]}
        type="textarea"
        rows="8"
        label="Explain it simply (optional)"
        hint="An everyday example or analogy works best. Markdown works."
      />
      <div class="actions">
        <button type="submit" class="button">Save</button>
        <a href={~p"/admin/jargon"} class="button button-quiet">Cancel</a>
      </div>
    </.form>
    """
  end
end
