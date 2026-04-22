import { registerApplication, start } from "single-spa";
import { constructApplications, constructRoutes, constructLayoutEngine } from "single-spa-layout";
import microfrontendLayout from "./microfrontend-layout.html";

async function init() {
  try {
    // 1. Fetch version.json and set on window
    const response = await fetch("/version.json");
    const versionData = await response.json();
    (window as any).__VERSION__ = versionData;
    console.log("Version info loaded:", versionData);
  } catch (error) {
    console.error("Failed to load version.json", error);
    (window as any).__VERSION__ = {}; // fallback
  }

  // 2. Construct routes and apps
  const routes = constructRoutes(microfrontendLayout);
  const applications = constructApplications({
    routes,
    loadApp({ name }) {
      return System.import(name);
    },
  });
  const layoutEngine = constructLayoutEngine({ routes, applications });

  // 3. Register apps and start single-spa
  applications.forEach(registerApplication);
  layoutEngine.activate();
  start();
}

// Call init
init();
