// src/components/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

function Join() {
  const navigate = useNavigate();
  const savedUsername = localStorage.getItem('username');

  useEffect(() => { if (!savedUsername) navigate('/auth'); }, [navigate, savedUsername]);

  const [isJoinMode, setIsJoinMode] = useState(true);
  const [roomError, setRoomError] = useState('');
  
  const [roomIdInput, setRoomIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(savedUsername || ''); 
  const [recentRooms, setRecentRooms] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecentRoom, setSelectedRecentRoom] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const modalPasswordRef = useRef(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (username) {
      localStorage.removeItem("recentRooms"); 
      const history = JSON.parse(localStorage.getItem(`recentRooms_${username}`) || "[]");
      setRecentRooms(history);
    }
  }, [username]);

  useEffect(() => { if (isModalOpen && modalPasswordRef.current) modalPasswordRef.current.focus(); }, [isModalOpen]);

  const triggerRoomTransition = (targetRoomId, roomPassword) => {
    setIsConnecting(true);
    setTimeout(() => {
      navigate(`/room/${targetRoomId}`, { state: { password: roomPassword, username } });
    }, 3500); 
  };

  const handleRoomAction = async (e) => {
    e.preventDefault();
    setRoomError('');
    const trimmedId = roomIdInput.trim();
    if (!trimmedId) return;

    try {
      const res = await fetch(`http://localhost:5000/api/room/${trimmedId}`);

      if (isJoinMode) {
        // FIXED: Only check for 404 status
        if (res.status === 404) {
          setRoomError("Room does not exist. Please switch to 'Create' to make a new one.");
          return;
        }
      } else {
        // FIXED: Only check for 200 status
        if (res.status === 200) {
          setRoomError("Room already exists. Please switch to 'Join' to enter.");
          return;
        }
      }
      triggerRoomTransition(trimmedId, password);
    } catch (err) {
      triggerRoomTransition(trimmedId, password); 
    }
  };

  const handleCreateRandom = () => triggerRoomTransition(uuidv4(), '');

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecentRoom) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/room/${selectedRecentRoom}`);
      
      // FIXED: Only check for 404 status
      if (res.status === 404) { 
        alert("This workspace no longer exists. It may have been deleted.");
        const updatedHistory = recentRooms.filter(room => room !== selectedRecentRoom);
        setRecentRooms(updatedHistory);
        localStorage.setItem(`recentRooms_${username}`, JSON.stringify(updatedHistory));
        setIsModalOpen(false);
        return;
      }
      triggerRoomTransition(selectedRecentRoom, modalPassword);
    } catch (err) {
      triggerRoomTransition(selectedRecentRoom, modalPassword);
    }
  };

  const handleRecentRoomClick = (room) => {
    setSelectedRecentRoom(room);
    setModalPassword(''); 
    setIsModalOpen(true); 
  };

  const handleDeleteClick = (e, room) => {
    e.stopPropagation();
    setRoomToDelete(room);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    try {
      const res = await fetch(`http://localhost:5000/api/room/${roomToDelete}?username=${username}`, { method: 'DELETE' });
      
      if (res.status === 403) {
        // Silently handle the 403 (user is not the owner)
      } else if (!res.ok && res.status !== 404) {
        throw new Error("Failed to communicate with server");
      }

      // Clear from local UI history regardless of backend global deletion
      const updatedHistory = recentRooms.filter(room => room !== roomToDelete);
      setRecentRooms(updatedHistory);
      localStorage.setItem(`recentRooms_${username}`, JSON.stringify(updatedHistory));
      
      setIsDeleteModalOpen(false);
      setRoomToDelete(null);
    } catch (error) {
      console.error("Failed to delete room", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/auth');
  };

  return (
    <div className="relative h-screen w-full bg-black text-zinc-50 flex flex-col overflow-hidden font-sans">
      
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <AnimatePresence>
        {isConnecting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 mb-8 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
            <h2 className="text-xl font-bold text-zinc-50 mb-2 tracking-wide">Connecting</h2>
            <p className="text-zinc-500 font-mono text-xs">Securing workspace...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative z-50 w-full flex justify-between items-center px-6 md:px-12 pt-6 pb-2 min-h-[80px] shrink-0">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => navigate('/')} className="flex items-center space-x-3 cursor-pointer group">
          <div className="w-8 h-8 rounded bg-[#111111] border border-zinc-800 flex items-center justify-center transition-colors group-hover:border-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-50">Collab<span className="text-blue-500 font-semibold">Space</span></span>
        </motion.div>

        <div className="flex items-center space-x-6">
          <motion.button initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate('/')} className="hidden md:flex items-center space-x-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            <span>Home</span>
          </motion.button>
          {username && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="relative">
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-9 h-9 rounded-full bg-[#111111] border border-zinc-800 flex items-center justify-center text-zinc-50 text-sm hover:bg-zinc-800 transition-colors">
                  {username.charAt(0).toUpperCase()}
                </button>
                <AnimatePresence>
                  {showProfileMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                      <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className="absolute right-0 mt-2 w-48 bg-[#111111] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-800">
                          <p className="text-sm font-medium text-zinc-50 truncate">{username}</p>
                        </div>
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors">Logout</button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </div>
      </header>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-16 grow pb-6 overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="flex-1 lg:pr-12">
          <h1 className="text-5xl lg:text-6xl font-bold text-zinc-50 tracking-tight mb-6 leading-tight">
            Code faster. <br /><span className="text-blue-500">Build together.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mb-8 leading-relaxed">
            Minimalist real-time collaboration. Integrated Docker execution, live file syncing, and unified team chat.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-medium text-zinc-400">Real-Time Sync</span>
            <span className="px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-medium text-zinc-400">Docker Exec</span>
            <span className="px-3 py-1.5 rounded-full border border-zinc-800 text-xs font-medium text-zinc-400">In-Room Chat</span>
          </div>
        </motion.div>

        <div className="w-full max-w-md flex flex-col space-y-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-[#111111] p-6 rounded-xl border border-zinc-800 shadow-2xl">
            
            <h2 className="text-lg font-medium text-zinc-50 mb-4">Workspace</h2>
            
            <div className="flex bg-black border border-zinc-800 rounded-lg p-1 mb-6">
              <button 
                type="button" 
                onClick={() => { setIsJoinMode(true); setRoomError(''); }} 
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${isJoinMode ? 'bg-[#111111] text-zinc-50 shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Join
              </button>
              <button 
                type="button" 
                onClick={() => { setIsJoinMode(false); setRoomError(''); }} 
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${!isJoinMode ? 'bg-[#111111] text-zinc-50 shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Create
              </button>
            </div>

            {roomError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
                className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-2 text-red-400 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{roomError}</span>
              </motion.div>
            )}

            <form onSubmit={handleRoomAction} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  required 
                  value={roomIdInput} 
                  onChange={(e) => { setRoomIdInput(e.target.value); setRoomError(''); }} 
                  className="w-full bg-black text-zinc-50 px-4 py-2.5 border border-zinc-800 rounded-lg focus:outline-none focus:border-blue-500 transition-colors placeholder-zinc-600 text-sm" 
                  placeholder={isJoinMode ? "Enter Room ID to join" : "Create a unique Room ID"} 
                />
              </div>
              <div>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-black text-zinc-50 px-4 py-2.5 border border-zinc-800 rounded-lg focus:outline-none focus:border-blue-500 transition-colors placeholder-zinc-600 text-sm" 
                  placeholder={isJoinMode ? "Password (If secured)" : "Set a Password (Optional)"} 
                />
              </div>
              <button type="submit" className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-200 text-black font-semibold rounded-lg transition-colors text-sm mt-2">
                {isJoinMode ? 'Join Room' : 'Create Room'}
              </button>
            </form>
            
            {!isJoinMode && (
              <button onClick={handleCreateRandom} className="w-full mt-3 py-2.5 bg-transparent border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium rounded-lg transition-colors text-sm">
                Generate Random Room
              </button>
            )}
          </motion.div>

          {recentRooms.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] p-5 rounded-xl border border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">Recent Rooms</h3>
              <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                {recentRooms.map((room) => (
                  <div key={room} onClick={() => handleRecentRoomClick(room)} className="flex items-center justify-between p-2.5 bg-black border border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors group">
                    <span className="text-xs text-zinc-300 font-mono truncate w-[60%]">{room}</span>
                    <div className="flex items-center space-x-2">
                      <button onClick={(e) => handleDeleteClick(e, room)} className="text-zinc-600 hover:text-red-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#111111] p-6 rounded-xl w-96 border border-zinc-800" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-medium text-zinc-50 mb-2">Leave or Delete Workspace?</h3>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                If you created <span className="font-mono text-zinc-200">{roomToDelete}</span>, it will be destroyed. If you are a collaborator, it will only be removed from your history.
              </p>
              <div className="flex space-x-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-transparent border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-sm rounded-lg">Cancel</button>
                <button onClick={confirmDeleteRoom} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg">Remove</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#111111] p-6 rounded-xl w-80 border border-zinc-800 relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300">✕</button>
              <h3 className="text-lg font-medium text-zinc-50 mb-4">Secured Room</h3>
              <form onSubmit={handleModalSubmit} className="space-y-4">
                <input type="password" ref={modalPasswordRef} value={modalPassword} onChange={(e) => setModalPassword(e.target.value)} className="w-full bg-black text-zinc-50 px-4 py-2 border border-zinc-800 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="Password" />
                <button type="submit" className="w-full py-2 bg-zinc-50 hover:bg-zinc-200 text-black text-sm font-medium rounded-lg">Enter</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default Join;