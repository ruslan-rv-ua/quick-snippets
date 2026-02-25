import ReactDOM from "react-dom/client";
import App from "./App";

// Disable browser context menu (launcher-style app)
document.addEventListener('contextmenu', (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
