import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// pas de StrictMode : il monterait deux fois le cockpit 3D en développement
createRoot(document.getElementById("root")!).render(<App />);
