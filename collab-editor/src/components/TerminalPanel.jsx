// src/components/TerminalPanel.jsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css'; // Requires the CSS to look like a terminal

function TerminalPanel({ socket, roomId }) {
  const terminalRef = useRef(null);
  const term = useRef(null);
  const fitAddon = useRef(null);

  useEffect(() => {
    // 1. Initialize the UI
    term.current = new Terminal({
      theme: {
        background: '#111111',
        foreground: '#fafafa',
        cursor: '#3b82f6',
        selectionBackground: '#ffffff40'
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
    });
    
    fitAddon.current = new FitAddon();
    term.current.loadAddon(fitAddon.current);
    
    // Mount it to the DOM
    term.current.open(terminalRef.current);
    fitAddon.current.fit();

    // 2. Send local keystrokes TO the backend
    term.current.onData((data) => {
      socket.emit("terminal-input", { roomId, input: data });
    });

    // 3. Receive system responses FROM the backend
    const handleOutput = (data) => {
      term.current.write(data);
    };
    socket.on("terminal-output", handleOutput);

    // 4. Handle Window Resizing
    const handleResize = () => {
      fitAddon.current.fit();
      socket.emit("terminal-resize", { 
        roomId, 
        cols: term.current.cols, 
        rows: term.current.rows 
      });
    };
    window.addEventListener('resize', handleResize);

    // Initial resize trigger
    setTimeout(handleResize, 100);

    return () => {
      socket.off("terminal-output", handleOutput);
      window.removeEventListener('resize', handleResize);
      term.current.dispose();
    };
  }, [roomId, socket]);

  return (
    <div className="w-full h-full bg-[#111111] overflow-hidden p-2 pt-3">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}

export default TerminalPanel;