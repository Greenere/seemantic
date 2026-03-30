import { SemanticEditorPage } from "../features/editor-shell/SemanticEditorPage";
import { EditorStoreProvider } from "../state/EditorStore";

export function App() {
  return (
    <EditorStoreProvider>
      <SemanticEditorPage />
    </EditorStoreProvider>
  );
}
