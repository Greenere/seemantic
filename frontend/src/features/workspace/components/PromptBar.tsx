import type { FormEvent } from "react";
import { useEditorStore } from "../../../state/EditorStore";

export function PromptBar() {
  const { state, dispatch } = useEditorStore();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "applyPrompt" });
  }

  return (
    <form className="prompt-form" onSubmit={handleSubmit}>
      <input
        className="prompt-input"
        type="text"
        value={state.prompt}
        onChange={(event) => dispatch({ type: "setPrompt", value: event.target.value })}
        placeholder="Describe the semantic edit you want to make..."
      />
      <button type="submit" className="ghost-button">
        Apply Mock Prompt
      </button>
    </form>
  );
}
