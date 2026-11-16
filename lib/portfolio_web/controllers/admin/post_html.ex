defmodule PortfolioWeb.Admin.PostHTML do
  use PortfolioWeb, :html

  embed_templates "post_html/*"

  attr :form, Phoenix.HTML.Form, required: true
  attr :action, :string, required: true
  attr :method, :string, default: "post"

  def post_form(assigns) do
    ~H"""
    <.form for={@form} action={@action} method={@method} class="editor">
      <.input field={@form[:title]} label="Title" required autofocus />
      <.input
        field={@form[:summary]}
        type="textarea"
        rows="2"
        label="Summary (optional)"
        hint="One or two sentences. Shown in lists, link previews and RSS."
      />
      <.input
        field={@form[:body]}
        type="textarea"
        rows="22"
        label="Post"
        hint="Markdown: blank line between paragraphs, **bold**, *italic*, ## heading, > quote, - list, [link](https://...)."
        required
      />
      <.input
        field={@form[:slug]}
        label="Web address (optional)"
        hint="Leave empty to build it from the title, e.g. my-first-thought."
      />
      <.input field={@form[:published]} type="checkbox" label="Published (visible to everyone)" />
      <div class="actions">
        <button type="submit" class="button">Save</button>
        <a href={~p"/admin"} class="button button-quiet">Cancel</a>
      </div>
    </.form>
    """
  end
end
