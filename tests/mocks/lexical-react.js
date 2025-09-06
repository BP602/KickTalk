export const LexicalComposer = ({ children }) => children
export const PlainTextPlugin = () => null
export const AutoFocusPlugin = () => null
export const RichTextPlugin = () => null
export const ContentEditable = () => null
export const HistoryPlugin = () => null
export const LexicalErrorBoundary = {}
export const useLexicalComposerContext = () => [{
  update: (fn) => fn?.(),
  focus: () => {},
  registerCommand: () => () => {},
  registerNodeTransform: () => () => {},
  registerUpdateListener: () => () => {},
  getRootElement: () => (typeof document !== 'undefined' ? document.createElement('div') : null),
}]
