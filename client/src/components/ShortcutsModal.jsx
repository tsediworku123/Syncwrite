const SHORTCUTS = [
  {category: "Formatting", shortcuts: [
    {keys: "Ctrl + B",       label: "Bold"},
    {keys: "Ctrl + I",       label: "Italic"},
    {keys: "Ctrl + U",       label: "Underline"},
    {keys: "Ctrl + E",       label: "Inline code"},
    {keys: "Ctrl + K",       label: "Insert / edit link"},
    {keys: "Ctrl + Alt + 1", label: "Heading 1"},
    {keys: "Ctrl + Alt + 2", label: "Heading 2"},
    {keys: "Ctrl + Alt + 3", label: "Heading 3"},
  ]},
  {category: "Editing", shortcuts: [
    {keys: "Ctrl + Z",             label: "Undo"},
    {keys: "Ctrl + Shift + Z",     label: "Redo"},
    {keys: "Ctrl + A",             label: "Select all"},
    {keys: "Ctrl + F",             label: "Find & Replace"},
    {keys: "Ctrl + Enter (comment)", label: "Post comment / reply"},
  ]},
  {category: "Panels", shortcuts: [
    {keys: "Ctrl + Shift + O", label: "Toggle Document Outline"},
    {keys: "Ctrl + Shift + H", label: "Toggle Version History"},
    {keys: "Ctrl + Shift + C", label: "Toggle Comments"},
    {keys: "Ctrl + Shift + S", label: "Toggle Share (owner only)"},
    {keys: "Ctrl + Shift + ?", label: "Toggle Keyboard Shortcuts"},
    {keys: "Escape",           label: "Close open panel / find bar"},
  ]},
];

export default function ShortcutsModal({onClose}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="side-panel-header">
          <h3>⌨️ Keyboard Shortcuts</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {SHORTCUTS.map(section => (
          <div key={section.category} className="shortcut-section">
            <h4 className="shortcut-category">{section.category}</h4>
            <table className="shortcut-table">
              <tbody>
                {section.shortcuts.map(({keys, label}) => (
                  <tr key={keys}>
                    <td><kbd>{keys}</kbd></td>
                    <td>{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
