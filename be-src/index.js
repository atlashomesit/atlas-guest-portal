import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { Provider } from "./Redux/simpleStore";

const root = ReactDOM.createRoot(
  document.getElementById("booking-engine-root")
);
root.render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>
);

reportWebVitals();
