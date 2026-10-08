import { useEffect, useState } from "react";
export function usePersonaNavigation() {
  const [editorState, setEditorState] = useState({ dirty: false, busy: false });
  useEffect(() => {
    if (!editorState.dirty && !editorState.busy) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [editorState.dirty, editorState.busy]);
  function canLeave() {
    return (
      !editorState.busy &&
      (!editorState.dirty ||
        window.confirm("Discard your unsaved persona changes?"))
    );
  }
  return { canLeave, setEditorState, editorBusy: editorState.busy };
}
