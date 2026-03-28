import { configureStore } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import { reducer as reducerHotel } from './Hotel/reducer';
import { reducer as reducerUserData } from './UserData/reducer';
import { combineReducers } from 'redux';

// Combine reducers
const rootReducer = combineReducers({
  reducerHotel,
  reducerUserData,
});

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(thunk), // Correct way to add middleware
});

export default store;

