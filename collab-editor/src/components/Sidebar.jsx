// src/components/Sidebar.jsx
import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setActiveFile, addFile, deleteFile, setFiles } from "../store/filesSlice";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

const getFileLanguage = (filename) => {
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "js": return "javascript";
    case "html": return "html";
    case "css": return "css";
    case "py": return "python";
    case "json": return "json";
    default: return "text";
  }
};

const getFileIcon = (filename) => {
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "js": return <span className="text-yellow-500 font-bold">JS</span>;
    case "html": return <span className="text-orange-500 font-bold">&lt;&gt;</span>;
    case "css": return <span className="text-blue-400 font-bold">#</span>;
    case "py": return <span className="text-blue-500 font-bold">PY</span>;
    case "json": return <span className="text-zinc-400 font-bold">&#123;&#125;</span>;
    default: return <span className="text-zinc-500 font-bold">TXT</span>;
  }
};

const Sidebar = ({ socket, roomId }) => {
  const files = useSelector((state) => state.files.files);
  const activeFileId = useSelector((state) => state.files.activeFileId);
  const dispatch = useDispatch();

  const [newFileName, setNewFileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef(null);

  const [sidebarWidth, setSidebarWidth] = useState(280); 
  const isDragging = useRef(false);

  const [deleteModalConfig, setDeleteModalConfig] = useState({ isOpen: false, file: null });

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const chatScrollRef = useRef(null);
  
  const [currentUsername, setCurrentUsername] = useState(localStorage.getItem('username') || 'Anonymous');

  useEffect(() => {
    if (!socket || !roomId) return;
    const handleFileSync = (serverFiles) => dispatch(setFiles(serverFiles));
    const handleChatHistory = (messages) => setChatMessages(messages);
    const handleReceiveMessage = (message) => setChatMessages((prev) => [...prev, message]);
    
    const handleRoomUsers = (users) => {
      const me = users.find(u => u.id === socket.id);
      if (me && me.username) setCurrentUsername(me.username);
    };

    socket.on("file-tree-sync", handleFileSync);
    socket.on('chat-history', handleChatHistory);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('room-users-update', handleRoomUsers);
    
    socket.emit("request-file-tree", roomId);
    socket.emit("request-room-users", roomId);

    return () => {
      socket.off("file-tree-sync", handleFileSync);
      socket.off('chat-history', handleChatHistory);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('room-users-update', handleRoomUsers);
    };
  }, [socket, dispatch, roomId]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, isChatExpanded]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const newWidth = e.clientX;
    if (newWidth >= 220 && newWidth <= 500) setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  };

  const handleCreateFile = (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const finalName = newFileName.includes(".") ? newFileName : `${newFileName}.js`;
    const newFile = { id: uuidv4(), name: finalName, language: getFileLanguage(finalName) };
    const updatedFiles = [...files, newFile];
    
    dispatch(addFile(newFile));
    socket.emit("file-tree-update", { roomId, files: updatedFiles }); 
    dispatch(setActiveFile(newFile.id));

    setNewFileName("");
    setIsCreating(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const newFileId = uuidv4();
      const newFile = { id: newFileId, name: file.name, language: getFileLanguage(file.name) };
      const updatedFiles = [...files, newFile];
      
      dispatch(addFile(newFile));
      socket.emit("file-tree-update", { roomId, files: updatedFiles });
      dispatch(setActiveFile(newFileId));

      setTimeout(() => { window.dispatchEvent(new CustomEvent("inject-yjs-content", { detail: { fileId: newFileId, content } })); }, 100); 
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDeleteRequest = (e, file) => {
    e.stopPropagation(); 
    setDeleteModalConfig({ isOpen: true, file });
  };

  const confirmDeleteFile = () => {
    if (!deleteModalConfig.file) return;
    const id = deleteModalConfig.file.id;
    const updatedFiles = files.filter((f) => f.id !== id);
    dispatch(deleteFile(id));
    socket.emit("file-tree-update", { roomId, files: updatedFiles }); 
    setDeleteModalConfig({ isOpen: false, file: null });
  };

  const triggerDownload = () => window.dispatchEvent(new CustomEvent("download-active-file"));

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMessage = {
      id: Date.now() + Math.random(),
      sender: currentUsername,
      socketId: socket.id,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('send-message', { roomId, message: newMessage });
    setChatInput('');
  };

  return (
    <>
      <div className="relative bg-[#111111] border-r border-zinc-800 flex flex-col h-full shrink-0 select-none text-zinc-50" style={{ width: `${sidebarWidth}px` }}>
        <div onMouseDown={handleMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-zinc-700 transition-colors z-50" style={{ transform: 'translateX(50%)' }} />

        <div className="p-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <span className="text-zinc-400 font-semibold text-xs tracking-wider">FILES</span>
          <div className="flex items-center space-x-3">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current.click()} className="text-zinc-500 hover:text-zinc-300 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></button>
            <button onClick={triggerDownload} disabled={!activeFileId} className={`transition-colors ${activeFileId ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-800 cursor-not-allowed'}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
            <button onClick={() => setIsCreating(!isCreating)} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none transition-colors">+</button>
          </div>
        </div>

        {isCreating && (
          <form onSubmit={handleCreateFile} className="p-2 border-b border-zinc-800 shrink-0">
            <input type="text" autoFocus value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="filename.ext" className="w-full bg-black text-zinc-50 text-xs px-3 py-2 border border-zinc-800 rounded outline-none focus:border-zinc-500" onBlur={() => setTimeout(() => setIsCreating(false), 150)} />
          </form>
        )}

        <div className="grow overflow-y-auto py-2 custom-scrollbar">
          {files.map((file) => (
            <div key={file.id} onClick={() => dispatch(setActiveFile(file.id))} className={`px-4 py-1.5 text-xs cursor-pointer flex items-center justify-between group transition-colors ${activeFileId === file.id ? "bg-black text-zinc-50 border-l border-zinc-300" : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 border-l border-transparent"}`}>
              <div className="flex items-center space-x-2 overflow-hidden">
                <div className="w-4 text-center text-[10px] shrink-0">{getFileIcon(file.name)}</div>
                <span className="truncate">{file.name}</span>
              </div>
              <button onClick={(e) => handleDeleteRequest(e, file)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 px-1 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
          ))}
        </div>

        {/* LINEAR-STYLE CHAT */}
        <div className="flex flex-col border-t border-zinc-800 bg-[#111111] shrink-0 transition-all duration-300" style={{ height: isChatExpanded ? '45%' : '40px', minHeight: isChatExpanded ? '250px' : '40px' }}>
          <div className="px-4 h-[40px] flex justify-between items-center cursor-pointer hover:bg-zinc-900 transition-colors shrink-0" onClick={() => setIsChatExpanded(!isChatExpanded)}>
            <span className="text-zinc-400 font-semibold text-xs tracking-wider">TEAM CHAT</span>
            <span className="text-zinc-600 text-[10px]">{isChatExpanded ? '▼' : '▲'}</span>
          </div>

          {isChatExpanded && (
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-black" ref={chatScrollRef}>
                {chatMessages.length === 0 ? (
                  <div className="text-center text-zinc-600 text-xs mt-4">No messages yet.</div>
                ) : (
                  chatMessages.map(msg => {
                    const mySavedName = localStorage.getItem('username');
                    const safeCheck = (name) => name?.toLowerCase().trim();
                    const isMe = msg.socketId === socket.id || safeCheck(msg.sender) === safeCheck(currentUsername) || (mySavedName && safeCheck(msg.sender) === safeCheck(mySavedName));

                    return (
                      <div key={msg.id} className={`flex flex-col max-w-[90%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                        <div className="flex items-baseline space-x-1.5 mb-1">
                          <span className="text-[10px] text-zinc-500 font-medium">{isMe ? 'You' : msg.sender}</span>
                        </div>
                        <div className={`px-3 py-2 rounded text-xs leading-relaxed border ${isMe ? 'bg-[#111111] border-zinc-700 text-zinc-50' : 'bg-black border-zinc-800 text-zinc-300'}`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-[#111111] shrink-0 border-t border-zinc-800">
                <div className="bg-black border border-zinc-800 rounded p-1.5 flex items-end space-x-1 focus-within:border-zinc-600 transition-colors">
                  <textarea 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                    placeholder="Message..." 
                    className="flex-1 bg-transparent text-zinc-50 text-xs px-2 py-1 focus:outline-none resize-none min-h-[24px] max-h-[80px] custom-scrollbar placeholder-zinc-600"
                    rows="1"
                  />
                  <button onClick={handleSendMessage} disabled={!chatInput.trim()} className="text-zinc-500 hover:text-zinc-50 disabled:opacity-30 p-1 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform rotate-45" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {deleteModalConfig.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setDeleteModalConfig({ isOpen: false, file: null })}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#111111] p-6 rounded-xl w-96 border border-zinc-800" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-medium text-zinc-50 mb-2">Delete File?</h3>
              <p className="text-zinc-400 text-sm mb-6">Remove <span className="font-mono text-zinc-200">{deleteModalConfig.file?.name}</span>?</p>
              <div className="flex space-x-3">
                <button onClick={() => setDeleteModalConfig({ isOpen: false, file: null })} className="flex-1 py-2 bg-transparent border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-sm rounded-lg">Cancel</button>
                <button onClick={confirmDeleteFile} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;