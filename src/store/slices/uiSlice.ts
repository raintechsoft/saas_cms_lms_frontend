import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  sidebarCollapsed: boolean;
  globalSearch: string;
}

const initialState: UiState = {
  sidebarCollapsed: false,
  globalSearch: "",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    setGlobalSearch(state, action: PayloadAction<string>) {
      state.globalSearch = action.payload;
    },
  },
});

export const { setSidebarCollapsed, setGlobalSearch } = uiSlice.actions;
export default uiSlice.reducer;
