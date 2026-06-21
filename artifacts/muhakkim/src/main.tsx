import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installQuotaInterceptor } from "./lib/aiQuota";

installQuotaInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
