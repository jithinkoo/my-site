defmodule PortfolioWeb.Admin.PostHTML do
  use PortfolioWeb, :html

  embed_templates "post_html/*"

  attr :form, Phoenix.HTML.Form, required: true
  attr :action, :string, required: true
  attr :method, :string, default: "post"
  attr :cover_id, :integer, default: nil

  def post_form(assigns) do
    ~H"""
    <.form for={@form} action={@action} method={@method} multipart class="editor">
      <.input field={@form[:title]} label="Title" required autofocus />
      <.input
        field={@form[:summary]}
        type="textarea"
        rows="2"
        label="Summary (optional)"
        hint="One or two sentences shown in lists and link previews. Leave empty and the opening lines of the post are used, ending in “…”."
      />
      <div class="field">
        <label for="post_cover">Cover image (optional)</label>
        <div class="photo-row">
          <img :if={@cover_id} src={Portfolio.Media.path(@cover_id)} alt="Current cover" class="cover-preview" />
          <div>
            <input
              type="file"
              id="post_cover"
              name="post[cover]"
              accept="image/jpeg,image/png,image/webp"
              data-resize
            />
            <p class="hint" data-resize-note>
              Shown at the top of the post, as a thumbnail in lists, and when the post is shared.
            </p>
            <label :if={@cover_id} class="check-inline">
              <input type="checkbox" name="post[remove_cover]" value="true" /> Remove cover image
            </label>
          </div>
        </div>
      </div>
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
