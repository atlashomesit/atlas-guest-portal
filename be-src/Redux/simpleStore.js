import React, { createContext, useContext, useMemo, useReducer, useRef } from "react";
import { reducer as hotelReducer, initialState as hotelInitialState } from "./Hotel/reducer";
import { reducer as userReducer, initialState as userInitialState } from "./UserData/reducer";

const StoreContext = createContext();

const rootReducer = (state, action) => ({
  reducerHotel: hotelReducer(state.reducerHotel, action),
  reducerUserData: userReducer(state.reducerUserData, action),
});

export const Provider = ({ children }) => {
  const stateRef = useRef({
    reducerHotel: hotelInitialState,
    reducerUserData: userInitialState,
  });

  const [state, baseDispatch] = useReducer(rootReducer, stateRef.current);
  stateRef.current = state;

  const enhancedDispatch = (action) => {
    if (typeof action === "function") {
      return action(enhancedDispatch, () => stateRef.current);
    }
    baseDispatch(action);
    return action;
  };

  const value = useMemo(
    () => ({
      state,
      dispatch: enhancedDispatch,
    }),
    [state]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useDispatch = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useDispatch must be used within a Provider");
  }
  return context.dispatch;
};

export const useSelector = (selector) => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useSelector must be used within a Provider");
  }
  return selector(context.state);
};
