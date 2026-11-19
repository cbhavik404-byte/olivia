import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Global error guards to intercept unhandled promise rejections or script errors safely
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    console.warn("[Nexa Global Guard] Handled unhandled rejection:", event.reason);
    // Prevent unhandled rejection from bubbling up to browser uncaught exception reporter
    event.preventDefault();
  });

  window.addEventListener("error", (event) => {
    console.warn("[Nexa Global Guard] Handled window error:", event.message);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

