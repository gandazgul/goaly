# Phase 3: PWA & Mobile Experience Specification

## Overview

Optimize Goaly for mobile usage, ensuring it functions seamlessly on smaller
screens and provides a native-like experience. This phase introduces responsive
design polish, offline support via a Service Worker, and web manifest
configurations to allow users to install the app directly to their home screens.

---

## Detailed Task Breakdown

The following tasks are broken down into logical epics to implement the Phase 3
PWA capabilities.

### Group 1: Responsive Design & Mobile UX Polish

Ensure the application interface adapts gracefully to mobile devices and touch
interactions.

#### Task 1.1: Optimize Mobile Layout and Padding

- **Description:** Adjust the global layout containers to maximize usable space
  on smaller screens while maintaining readability.
- **Subtasks:**
  - Update main container padding in `src/pages/index.astro` to be responsive
    (e.g., `p-4` on mobile, `md:p-8` on desktop).
  - Ensure the header and "Add Goal" button are easily reachable and
    appropriately sized on mobile.
- **Acceptance Criteria:** The application feels uncluttered on mobile screens.
  Padding adapts to screen size without causing horizontal scrolling or cramped
  content.
- **Dependencies:** None.
- **Outcome:** Improves mobile readability and usability, making the dashboard
  feel custom-tailored to the user's device size.

#### Task 1.2: Refine Touch Interactions & Tap Targets

- **Description:** Adjust interactive elements (buttons, inputs) to ensure they
  are easily usable with touch inputs, and handle hover states correctly on
  non-hover devices.
- **Subtasks:**
  - Update `src/components/GoalCard.astro` to make action buttons (like delete
    or mark complete) always visible on touch devices, and only appear on hover
    for pointer devices (e.g., using
    `opacity-100 md:opacity-0 md:group-hover:opacity-100`).
  - Update `src/components/GoalForm.astro` to ensure all inputs and buttons have
    a minimum tap target size of 44x44px.
  - Set input font sizes to at least 16px to prevent auto-zooming on iOS
    devices.
- **Acceptance Criteria:** All buttons are easily tappable. No hover-exclusive
  actions hide critical functionality on mobile. Input fields do not trigger
  browser zoom when focused on iOS.
- **Dependencies:** Task 1.1.
- **Outcome:** Eliminates frustration on mobile devices by providing accessible,
  native-feeling touch interactions, ensuring users can quickly log habits on
  the go.

### Group 2: Offline Capabilities & Service Worker

Implement core offline functionality so the app remains accessible even without
a network connection.

#### Task 2.1: Create Offline Fallback Page

- **Description:** Design and implement a branded offline fallback HTML page to
  serve when the user has no internet connection.
- **Subtasks:**
  - Create a new static `public/offline.html` file.
  - Design a simple, branded UI explaining that the app requires an internet
    connection to sync goals.
  - Include basic styles directly in the HTML to ensure it renders correctly
    without external CSS.
- **Acceptance Criteria:** `offline.html` is visually consistent with the app
  branding and clearly communicates the offline status to the user.
- **Dependencies:** None.
- **Outcome:** Provides a graceful degradation of service when offline,
  preventing generic browser error screens and maintaining a professional app
  experience.

#### Task 2.2: Implement and Register Service Worker

- **Description:** Create a Service Worker to manage caching and intercept
  network requests, providing a network-first strategy with the offline
  fallback.
- **Subtasks:**
  - Create `public/sw.js`.
  - Implement an `install` event listener to pre-cache the `offline.html` file.
  - Implement a `fetch` event listener using a Network-First strategy for HTML
    requests. If the network fails, serve the cached `offline.html`.
  - Add cache versioning and an `activate` event listener to clean up old
    caches.
  - Add inline script to `src/layouts/Layout.astro` `<head>` to register the
    Service Worker on page load.
- **Acceptance Criteria:** Service Worker registers successfully without errors.
  Disconnecting from the network and refreshing the page serves the custom
  `offline.html` instead of the browser's default offline dinosaur page. API
  requests handle offline states gracefully (e.g., queuing or failing without
  redirecting to offline.html).
- **Dependencies:** Task 2.1.
- **Outcome:** Makes the application resilient to spotty network conditions, a
  critical feature for a mobile-first tracking app that users might open
  anywhere.

### Group 3: App Installability (PWA)

Configure the application to be installable on user devices as a standalone app.

#### Task 3.1: Configure Web App Manifest

- **Description:** Define the application's metadata to allow browsers to prompt
  for installation and display it as a native-like app.
- **Subtasks:**
  - Update `public/site.webmanifest` with necessary fields: `name`,
    `short_name`, `start_url: "/?mode=pwa"`, `display: "standalone"`,
    `background_color`, and `theme_color`.
  - Generate and link required icon sizes (192x192, 512x512, and maskable icons)
    in the manifest.
  - Ensure the manifest is linked in the `<head>` of `src/layouts/Layout.astro`.
- **Acceptance Criteria:** Lighthouse PWA audit recognizes the manifest and
  icons. The app can be installed via Chrome/Edge desktop or Android install
  prompts. Launching the installed app opens it in standalone mode without
  browser UI.
- **Dependencies:** None.
- **Outcome:** Lowers the friction of opening the app by allowing users to add
  it directly to their home screen or dock, increasing retention and daily
  usage.

#### Task 3.2: Implement iOS-Specific PWA Meta Tags

- **Description:** Add Apple-specific meta tags to ensure the PWA behaves
  correctly when installed on iOS devices.
- **Subtasks:**
  - Add `<meta name="apple-mobile-web-app-capable" content="yes">` to
    `src/layouts/Layout.astro`.
  - Add `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
    (or `black-translucent`).
  - Add `<link rel="apple-touch-icon" href="...">` pointing to a properly
    formatted iOS icon.
- **Acceptance Criteria:** Saving the app to an iOS home screen uses the correct
  icon. Launching the app on iOS opens it in full-screen mode with the
  configured status bar style.
- **Dependencies:** Task 3.1.
- **Outcome:** Guarantees a first-class, native-app-like experience for iOS
  users, overcoming Safari's specific PWA requirements.
