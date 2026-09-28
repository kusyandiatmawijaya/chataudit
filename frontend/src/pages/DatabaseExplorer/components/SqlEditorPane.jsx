import React, { useRef, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

export const SqlEditorPane = ({ value, onChange, onExecute }) => {
  const monaco = useMonaco();
  const editorRef = useRef(null);

  useEffect(() => {
    if (monaco) {
      // Define a custom theme if desired, or just use vs-dark
      monaco.editor.defineTheme('my-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
        }
      });
    }
  }, [monaco]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add F5 keybinding to execute
    editor.addCommand(monaco.KeyCode.F5, () => {
      onExecute();
    });
  };

  return (
    <div className="w-full h-full pt-2">
      <Editor
        height="100%"
        defaultLanguage="pgsql"
        language="pgsql"
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          padding: { top: 10 },
          lineNumbersMinChars: 3,
        }}
      />
    </div>
  );
};
