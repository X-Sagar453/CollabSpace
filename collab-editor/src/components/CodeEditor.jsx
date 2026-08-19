// src/components/CodeEditor.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActiveFile } from '../store/filesSlice';
import CodeMirror from '@uiw/react-codemirror';
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import TerminalPanel from "./TerminalPanel";

import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';

const EditorPane = ({ ydoc, activeFileId, activeFile }) => {
  const [initialValue] = useState(() => {
    return ydoc ? ydoc.getText(activeFileId).toString() : '';
  });

  const extensions = useMemo(() => {
    if (!ydoc || !activeFileId || !activeFile) return [];
    const ytext = ydoc.getText(activeFileId);
    let langExtension;
    switch (activeFile.language) {
      case 'html': langExtension = html(); break;
      case 'css': langExtension = css(); break;
      case 'python': langExtension = python(); break;
      default: langExtension = javascript({ jsx: true }); 
    }
    return [ langExtension, yCollab(ytext) ];
  }, [ydoc, activeFileId, activeFile?.language]);

  return (
    <CodeMirror
      value={initialValue}
      height="100%"
      theme="dark"
      extensions={extensions}
      className="h-full text-sm"
    />
  );
};

const CodeEditor = ({ socket, roomId }) => {
  const files = useSelector((state) => state.files.files);
  const activeFileId = useSelector((state) => state.files.activeFileId);
  const activeFile = files.find(f => f.id === activeFileId);
  const dispatch = useDispatch();

  const [ydoc, setYdoc] = useState(null);
  const [activeUsers, setActiveUsers] = useState(1);
  const [ping, setPing] = useState(0);

  const [terminalHeight, setTerminalHeight] = useState(200); 
  const isDraggingTerminal = useRef(false);

  const handleTerminalMouseDown = (e) => {
    e.preventDefault();
    isDraggingTerminal.current = true;
    document.addEventListener("mousemove", handleTerminalMouseMove);
    document.addEventListener("mouseup", handleTerminalMouseUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const handleTerminalMouseMove = (e) => {
    if (!isDraggingTerminal.current) return;
    const newHeight = window.innerHeight - e.clientY - 30;
    if (newHeight >= 40 && newHeight <= window.innerHeight * 0.8) setTerminalHeight(newHeight);
  };

  const handleTerminalMouseUp = () => {
    isDraggingTerminal.current = false;
    document.removeEventListener("mousemove", handleTerminalMouseMove);
    document.removeEventListener("mouseup", handleTerminalMouseUp);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  };

  useEffect(() => {
    if (!socket || !roomId) return;
    const doc = new Y.Doc();
    setYdoc(doc);

    doc.on('update', (update, origin) => {
      if (origin !== 'remote') socket.emit('code-update', { roomId, update });
    });

    const handleRemoteUpdate = (update) => Y.applyUpdate(doc, new Uint8Array(update), 'remote');
    const handleRoomMetrics = (metrics) => setActiveUsers(metrics.activeUsers);

    const handleInjectContent = (e) => {
      let { fileId, content } = e.detail;
      const ytext = doc.getText(fileId);
      if (ytext.length === 0 && content) {
        const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        ytext.insert(0, normalizedContent);
      }
    };

    socket.on('code-update', handleRemoteUpdate);
    socket.on('room-metrics', handleRoomMetrics);
    window.addEventListener('inject-yjs-content', handleInjectContent);

    socket.emit('request-initial-code', roomId);

    const pingInterval = setInterval(() => {
      const start = Date.now();
      socket.emit('ping', () => setPing(Date.now() - start));
    }, 2000);

    return () => {
      socket.off('code-update', handleRemoteUpdate);
      socket.off('room-metrics', handleRoomMetrics);
      window.removeEventListener('inject-yjs-content', handleInjectContent);
      clearInterval(pingInterval);
      doc.destroy();
    };
  }, [socket, roomId]);

  useEffect(() => {
    const handleDownload = () => {
      if (!activeFileId || !ydoc || !activeFile) return;
      const content = ydoc.getText(activeFileId).toString();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = activeFile.name; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
    window.addEventListener('download-active-file', handleDownload);
    return () => window.removeEventListener('download-active-file', handleDownload);
  }, [activeFileId, activeFile, ydoc]);

  // ==========================================
  // NEW: SMART RUN BUTTON LOGIC
  // ==========================================
  const handleRunCode = () => {
    if (!ydoc || !activeFileId || !activeFile) return;
    const currentCode = ydoc.getText(activeFileId).toString();

    // Send the code directly to the new terminal engine!
    socket.emit("run-code", {
      roomId,
      filename: activeFile.name,
      code: currentCode
    });
  };

  const handlePreviewWebpage = () => {
    if (!ydoc) return;
    const indexFile = files.find(f => f.name.toLowerCase() === 'index.html');
    if (!indexFile) {
      alert("Oops! You need to create an 'index.html' file to preview a webpage.");
      return;
    }

    let htmlContent = ydoc.getText(indexFile.id).toString();

    files.forEach(file => {
      if (file.id !== indexFile.id) {
        const content = ydoc.getText(file.id).toString();
        let mimeType = 'text/plain';
        if (file.name.endsWith('.css')) mimeType = 'text/css';
        else if (file.name.endsWith('.js')) mimeType = 'application/javascript';

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const safeFileName = file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(=['"])(?:\\.\\/)?${safeFileName}(['"])`, 'g');
        htmlContent = htmlContent.replace(regex, `$1${url}$2`);
      }
    });

    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    const newWindow = window.open(htmlUrl, '_blank');
    if (!newWindow) alert("Please allow pop-ups in your browser to view the preview!");
  };

  if (!activeFileId) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-zinc-500">
        <svg className="w-12 h-12 mb-4 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p className="text-sm font-medium text-zinc-600">No file selected</p>
      </div>
    );
  }

  // Check if the file is a Python or JavaScript file so we can enable the button
  const isExecutable = activeFile?.name.endsWith('.js') || activeFile?.name.endsWith('.py');

  return (
    <div className="relative w-full h-full bg-black flex flex-col font-sans">
      
      {/* TABS */}
      <div className="flex bg-[#111111] border-b border-zinc-800 overflow-x-auto shrink-0 hide-scrollbar pt-2 px-2 gap-1">
        {files.map((file) => (
          <button
            key={file.id}
            onClick={() => dispatch(setActiveFile(file.id))}
            className={`px-4 py-1.5 text-xs rounded-t-md transition-colors ${
              activeFileId === file.id 
                ? 'bg-black text-zinc-50 border-t border-x border-zinc-800' 
                : 'bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-t border-x border-transparent'
            }`}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* ACTION BAR */}
      <div className="bg-black px-4 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
        <div className="flex items-center space-x-2 text-xs text-zinc-500 font-mono">
           <span>{activeFile.name}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handlePreviewWebpage}
            className="px-3 py-1 text-xs font-medium text-zinc-300 bg-[#111111] border border-zinc-800 rounded hover:bg-zinc-800 transition-colors"
          >
            Preview Webpage
          </button>

          {/* SMART RUN BUTTON */}
          <button 
            onClick={handleRunCode}
            disabled={!isExecutable}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              !isExecutable 
                ? 'bg-[#111111] text-zinc-600 border border-zinc-800 cursor-not-allowed' 
                : 'bg-zinc-50 text-black hover:bg-zinc-200'
            }`}
          >
            Run Code
          </button>
        </div>
      </div>

      {/* EDITOR */}
      <div className="grow overflow-hidden bg-black">
        <EditorPane key={activeFileId} ydoc={ydoc} activeFileId={activeFileId} activeFile={activeFile} />
      </div>

      {/* TERMINAL RESIZER */}
      <div 
        onMouseDown={handleTerminalMouseDown}
        className="h-1 bg-zinc-800 hover:bg-blue-500 cursor-row-resize transition-colors z-10 shrink-0"
      />

      {/* INTERACTIVE TERMINAL */}
      <div 
        className="bg-[#111111] border-t border-zinc-800 shrink-0 flex flex-col" 
        style={{ height: `${terminalHeight}px`, minHeight: '40px' }}
      >
        <div className="flex justify-between items-center px-4 py-1.5 bg-[#0a0a0a] border-b border-zinc-800 text-zinc-500 select-none shrink-0 uppercase tracking-widest text-[10px]">
          <span>Interactive Shell</span>
        </div>
        
        <div className="flex-grow overflow-hidden relative">
           <TerminalPanel socket={socket} roomId={roomId} />
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="bg-[#111111] border-t border-zinc-800 text-zinc-500 px-4 py-1.5 flex justify-between items-center text-[10px] uppercase tracking-wider shrink-0 select-none">
        <div className="flex space-x-6">
          <span>Users: {activeUsers}</span>
          <span>Ping: {ping}ms</span>
        </div>
        <div>
          <span className="text-emerald-500 font-semibold">Terminal Connected</span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;