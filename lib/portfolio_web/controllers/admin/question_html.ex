defmodule PortfolioWeb.Admin.QuestionHTML do
  use PortfolioWeb, :html

  embed_templates "question_html/*"

  def duration(ms) do
    total = div(ms, 1000)
    "#{div(total, 60)}:#{String.pad_leading(Integer.to_string(rem(total, 60)), 2, "0")}"
  end

  attr :form, Phoenix.HTML.Form, required: true
  attr :action, :string, required: true
  attr :method, :string, default: "post"

  def question_form(assigns) do
    ~H"""
    <.form for={@form} action={@action} method={@method} class="editor">
      <.input
        field={@form[:text]}
        label="Question"
        placeholder="e.g. How many squares are on a chessboard?"
        maxlength="300"
        required
        autofocus
      />
      <div class="field-row">
        <.input field={@form[:option_a]} label="Option A" placeholder="e.g. 64" maxlength="120" required />
        <.input field={@form[:option_b]} label="Option B" placeholder="e.g. 32" maxlength="120" required />
      </div>
      <div class="field">
        <span class="label">Correct answer</span>
        <div class="radio-row">
          <label class="check-inline">
            <input type="radio" name="question[correct]" value="a" checked={@form[:correct].value == "a"} required />
            Option A
          </label>
          <label class="check-inline">
            <input type="radio" name="question[correct]" value="b" checked={@form[:correct].value == "b"} />
            Option B
          </label>
        </div>
        <p :for={{msg, _} <- @form[:correct].errors} class="field-error">{msg}</p>
      </div>
      <.input
        field={@form[:explanation]}
        label="Short reason (optional)"
        placeholder="e.g. 8 × 8 = 64 squares!"
        hint="One short sentence. Pops up for a couple of seconds only when someone answers wrong. Up to 120 characters."
        maxlength="120"
      />
      <.input field={@form[:active]} type="checkbox" label="Use this question in the quiz" />
      <div class="actions">
        <button type="submit" class="button">Save</button>
        <a href={~p"/admin/questions"} class="button button-quiet">Cancel</a>
      </div>
    </.form>
    """
  end
end
