// src/components/EditorPage.jsx
import React, { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import CodeEditor from "./CodeEditor";
import Sidebar from "./Sidebar";
import { socket } from "../socket";
import { motion, AnimatePresence } from "framer-motion";

function EditorPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams(); 
  
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [activeUsers, setActiveUsers] = useState([]); 
  const [showDropdown, setShowDropdown] = useState(false); 
  const [isCopied, setIsCopied] = useState(false); 

  const password = location.state?.password || searchParams.get('pwd') || null;
  
  const initialUsername = location.state?.username || sessionStorage.getItem(`username-${roomId}`) || "";
  const [localUsername, setLocalUsername] = useState(initialUsername);
  const [hasJoined, setHasJoined] = useState(!!initialUsername);

  // Determine current user's role for UI conditionals
  const currentUser = activeUsers.find(u => u.username === localUsername);
  const isOwner = currentUser?.role === 'owner';

  useEffect(() => {
    if (roomId && hasJoined && localUsername) {
      const historyKey = `recentRooms_${localUsername}`;
      const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
      const updatedHistory = [roomId, ...history.filter(id => id !== roomId)].slice(0, 5);
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    }
  }, [roomId, hasJoined, localUsername]);

  useEffect(() => {
    if (!hasJoined || !localUsername) return;

    function onConnect() { 
      setIsConnected(true); 
      socket.emit("join-room", { roomId, password, username: localUsername });
    }
    
    function onDisconnect() { 
      setIsConnected(false); 
    }

    function onUsersUpdate(usersList) {
      const uniqueUsers = Array.from(new Map(usersList.map(u => [u.id, u])).values());
      setActiveUsers(uniqueUsers);
    }

    const handleAuthError = (errorMessage) => {
      alert(errorMessage); 
      navigate('/');      
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-users-update", onUsersUpdate);
    socket.on('auth-error', handleAuthError);

    if (socket.connected) {
      setIsConnected(true);
      socket.emit("join-room", { roomId, password, username: localUsername });
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-users-update", onUsersUpdate);
      socket.off('auth-error', handleAuthError);
    };
  }, [roomId, password, localUsername, hasJoined, navigate]);

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    if (password) {
      url.searchParams.set('pwd', password);
    }
    navigator.clipboard.writeText(url.toString());
    
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-zinc-50 overflow-hidden relative font-sans">
      
      {!hasJoined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111111] p-8 rounded-xl shadow-2xl w-96 border border-zinc-800 relative">
            <h3 className="text-xl font-medium text-zinc-50 mb-2">Welcome to the Room</h3>
            <p className="text-zinc-400 text-xs mb-6">Please enter your name to join the workspace.</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (localUsername.trim()) {
                sessionStorage.setItem(`username-${roomId}`, localUsername.trim());
                setHasJoined(true);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  value={localUsername}
                  onChange={(e) => setLocalUsername(e.target.value)}
                  className="w-full bg-black text-zinc-50 px-4 py-2.5 border border-zinc-800 rounded-lg focus:outline-none focus:border-blue-500 text-xs placeholder-zinc-600"
                  placeholder="e.g., CodeNinja"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-zinc-50 hover:bg-zinc-200 text-black font-semibold rounded-lg transition-colors text-xs"
              >
                Join Workspace
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="h-14 bg-black border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 select-none z-40">
        
        <div className="flex items-center space-x-6">
          <div 
            onClick={() => navigate('/join')}
            className="flex items-center space-x-3 cursor-pointer group"
            title="Return to Join"
          >
            <div className="w-8 h-8 rounded bg-[#111111] border border-zinc-800 flex items-center justify-center transition-colors group-hover:border-zinc-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-50 hidden sm:block">
              Collab<span className="text-blue-500 font-semibold">Space</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#111111] border border-zinc-800 rounded-md">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
            <span className="text-xs font-mono text-zinc-400">
              {isConnected ? `Room: ${roomId.substring(0, 8)}` : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 relative">
          
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-[#111111] border border-zinc-800 rounded-md text-xs text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              <span>Collaborators</span>
              <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-50 rounded text-[10px] font-medium">
                {activeUsers.length}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${showDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  ></div>

                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 bg-[#111111] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2 border-b border-zinc-800 bg-black flex justify-between items-center">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active in Room</h4>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                      {activeUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-zinc-900 transition-colors">
                          
                          <div className="flex items-center min-w-0 pr-2">
                            <div className="w-6 h-6 rounded bg-zinc-800 flex shrink-0 items-center justify-center text-zinc-300 text-[10px] font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="ml-2.5 text-xs text-zinc-300 truncate max-w-[80px]" title={user.username}>
                              {user.username}
                            </span>
                            {(user.username === localUsername || user.id === socket.id) && (
                              <span className="ml-2 text-[9px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>

                          {/* ROLE SELECTOR UI */}
                          <div className="flex shrink-0 items-center">
                            {isOwner && user.role !== 'owner' ? (
                              <select 
                                value={user.role || 'viewer'} 
                                onChange={(e) => socket.emit("change-role", { roomId, targetUserId: user.id, newRole: e.target.value })}
                                className="bg-black border border-zinc-700 text-[10px] text-zinc-300 py-1 px-1.5 rounded outline-none focus:border-blue-500"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                              </select>
                            ) : (
                              <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
                                user.role === 'owner' ? 'bg-blue-500/20 text-blue-400' :
                                user.role === 'editor' ? 'bg-emerald-500/20 text-emerald-400' :
                                'bg-zinc-800 text-zinc-500'
                              }`}>
                                {user.role || 'viewer'}
                              </span>
                            )}
                          </div>

                        </div>
                      ))}
                      
                      {activeUsers.length === 0 && (
                        <div className="px-4 py-4 text-xs text-zinc-600 text-center italic">Loading users...</div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleCopyLink}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              isCopied ? "bg-emerald-600 text-white" : "bg-zinc-50 hover:bg-zinc-200 text-black"
            }`}
          >
            {isCopied ? "Copied!" : "Copy Link"}
          </button>

        </div>
      </header>

      <main className="grow flex w-full h-full overflow-hidden">
        {/* Pass activeUsers to Sidebar so it can disable file uploads for viewers if needed */}
        <Sidebar socket={socket} roomId={roomId} activeUsers={activeUsers} localUsername={localUsername} />
        <div className="grow relative h-full">
          {/* Pass activeUsers and localUsername to CodeEditor to handle readOnly state */}
          <CodeEditor socket={socket} roomId={roomId} activeUsers={activeUsers} localUsername={localUsername} />
        </div>
      </main>
    </div>
  );
}

export default EditorPage;