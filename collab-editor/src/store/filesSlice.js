// src/store/filesSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  files: [], // Starting with an empty workspace
  activeFileId: null,
};

export const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setActiveFile: (state, action) => {
      state.activeFileId = action.payload;
    },
    addFile: (state, action) => {
      state.files.push(action.payload);
      state.activeFileId = action.payload.id;
    },
    deleteFile: (state, action) => {
      const idToDelete = action.payload;
      state.files = state.files.filter(file => file.id !== idToDelete);
      
      // If we deleted the currently active file, switch to the first available file
      if (state.activeFileId === idToDelete) {
        state.activeFileId = state.files.length > 0 ? state.files[0].id : null;
      }
    },
    // CRITICAL FIX: The setFiles reducer must be defined here
    setFiles: (state, action) => {
      state.files = action.payload;
      
      // Ensure the active file is still valid, otherwise select the first file
      if (!state.files.find(f => f.id === state.activeFileId)) {
         state.activeFileId = state.files.length > 0 ? state.files[0].id : null;
      }
    }
  },
});

// CRITICAL FIX: setFiles must be included in this export list!
export const { setActiveFile, addFile, deleteFile, setFiles } = filesSlice.actions;
export default filesSlice.reducer;