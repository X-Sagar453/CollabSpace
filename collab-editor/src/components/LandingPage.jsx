// src/components/LandingPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// --- Animation Variants ---
const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.2 }
  }
};

const heroItemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } 
  }
};

const codeContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 1.2 }
  }
};

const codeLineVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
};

function LandingPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUsername('');
    setShowProfileMenu(false);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-50 flex flex-col font-sans selection:bg-zinc-800 relative overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
      
      {/* ULTRA MINIMAL BACKGROUND GRID */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"></div>

      {/* Navigation Bar */}
      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex items-center justify-between px-6 md:px-12 py-6 max-w-7xl w-full mx-auto relative z-20"
      >
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded bg-[#111111] border border-zinc-800 flex items-center justify-center transition-colors group-hover:border-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-50">
            Collab<span className="text-blue-500 font-semibold">Space</span>
          </span>
        </div>

        <div className="flex items-center space-x-4 md:space-x-6">
          {username ? (
            <>
              <button 
                onClick={() => navigate('/join')} 
                className="hidden md:block text-sm font-semibold text-zinc-400 hover:text-zinc-50 transition-colors"
              >
                Go to Workspace
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-10 h-10 rounded-full bg-[#111111] border border-zinc-800 flex items-center justify-center text-zinc-50 font-medium text-sm hover:bg-zinc-800 transition-colors"
                >
                  {username.charAt(0).toUpperCase()}
                </button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-[#111111] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-zinc-800 bg-black">
                          <p className="text-sm font-medium text-zinc-50 truncate">{username}</p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 transition-colors"
                        >
                          Logout
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/auth')} className="text-sm font-medium text-zinc-400 hover:text-zinc-50 transition-colors">
                Login
              </button>
              <button onClick={() => navigate('/auth')} className="px-4 py-2 text-sm font-semibold bg-zinc-50 hover:bg-zinc-200 text-black rounded-lg transition-colors">
                Try Now
              </button>
            </>
          )}
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.main 
        variants={heroContainerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 mt-12 md:mt-20"
      >
        <motion.h1 variants={heroItemVariants} className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight max-w-4xl leading-[1.1] mb-6 text-zinc-50">
          Bold Ideas That <br className="hidden md:block"/> Start With Code.
        </motion.h1>
        
        <motion.p variants={heroItemVariants} className="text-zinc-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          We help modern developers craft digital solutions that inspire action and drive results. Experience real-time collaboration with zero friction.
        </motion.p>
        
        <motion.button 
          variants={heroItemVariants}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(username ? '/join' : '/auth')} 
          className="px-8 py-3.5 text-sm font-semibold bg-zinc-50 hover:bg-zinc-200 text-black rounded-lg transition-colors flex items-center space-x-2"
        >
          <span>{username ? 'Enter Workspace' : 'Get In Touch'}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </motion.button>

        {/* Ethereal Mockup - Minimalist */}
        <motion.div 
          variants={heroItemVariants}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="mt-20 w-full max-w-4xl relative"
        >
           <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent z-10 h-full"></div>
           <div className="h-64 md:h-96 w-full border border-zinc-800 rounded-t-xl bg-[#111111] overflow-hidden flex flex-col items-center pt-8 shadow-2xl relative">
              
              {/* Window Controls */}
              <div className="flex space-x-2 absolute top-4 left-4">
                <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
              </div>
              
              {/* Code Line Sequential Reveal */}
              <motion.pre 
                variants={codeContainerVariants}
                initial="hidden"
                animate="visible"
                className="text-left text-sm md:text-base font-mono text-zinc-300 p-8 w-full mt-4"
              >
                <motion.code variants={codeLineVariants} className="block text-zinc-400"><span className="text-blue-400">import</span> {`{ useState, useEffect }`} <span className="text-blue-400">from</span> 'react';</motion.code>
                <br/>
                <motion.code variants={codeLineVariants} className="block text-zinc-600">// Initialize real-time engine</motion.code>
                <motion.code variants={codeLineVariants} className="block text-zinc-300"><span className="text-blue-400">function</span> <span className="text-zinc-100">CollabEngine</span>() {`{`}</motion.code>
                <motion.code variants={codeLineVariants} className="block text-zinc-300 ml-4"><span className="text-blue-400">const</span> [vision, setVision] = <span className="text-blue-400">useState</span>('Bold Ideas');</motion.code>
                <motion.code variants={codeLineVariants} className="block text-zinc-300 ml-4"><span className="text-blue-400">return</span> &lt;<span className="text-blue-500">RealTimeCreation</span> /&gt;;</motion.code>
                <motion.code variants={codeLineVariants} className="block text-zinc-300">{`}`}</motion.code>
              </motion.pre>
           </div>
        </motion.div>
      </motion.main>

      {/* Infinite Logo Scroll */}
      <footer className="w-full py-10 flex flex-col items-center justify-center border-t border-zinc-800 bg-black relative z-20 overflow-hidden">
         <p className="text-xs text-zinc-600 font-medium uppercase tracking-widest mb-8">Trusted by teams of every scale</p>
         
         <div className="w-full flex overflow-hidden mask-image-linear-gradient">
            <motion.div 
              animate={{ x: ["0%", "-50%"] }} 
              transition={{ repeat: Infinity, ease: "linear", duration: 25 }}
              className="flex whitespace-nowrap min-w-max items-center opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500 gap-16 pr-16"
            >
              <span className="text-xl font-bold font-mono text-zinc-400">React</span>
              <span className="text-xl font-bold font-mono text-zinc-400">Node.js</span>
              <span className="text-xl font-bold font-mono text-zinc-400">MongoDB</span>
              <span className="text-xl font-bold font-mono text-zinc-400">Docker</span>
              <span className="text-xl font-bold font-mono text-zinc-400">WebSockets</span>
              <span className="text-xl font-bold font-mono text-zinc-400">Tailwind</span>
              
              <span className="text-xl font-bold font-mono text-zinc-400">React</span>
              <span className="text-xl font-bold font-mono text-zinc-400">Node.js</span>
              <span className="text-xl font-bold font-mono text-zinc-400">MongoDB</span>
              <span className="text-xl font-bold font-mono text-zinc-400">Docker</span>
              <span className="text-xl font-bold font-mono text-zinc-400">WebSockets</span>
              <span className="text-xl font-bold font-mono text-zinc-400">Tailwind</span>
            </motion.div>
         </div>
      </footer>

      <style dangerouslySetInnerHTML={{__html: `
        .mask-image-linear-gradient {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}} />
    </div>
  );
}

export default LandingPage;