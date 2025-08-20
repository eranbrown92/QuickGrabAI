# Privacy Practices Documentation for QuickGrabAI

## Single Purpose Description

QuickGrabAI is a Chrome extension that enables users to capture screenshots of web pages and analyze them using AI to get instant insights. Users can select specific areas of a webpage to analyze, and view their analysis history in a gallery.

## Permission Justifications

### 1. activeTab Permission

The activeTab permission is required to:

- Capture screenshots of the current tab using chrome.tabs.captureVisibleTab()
- Inject necessary CSS and JavaScript for the image selection interface
- This permission is essential for the core screenshot functionality and only activates when the user explicitly initiates a capture

### 2. Remote Code Justification

The extension uses remote code execution solely for:

- Communicating with the OpenAI API to analyze captured images
- This is done securely using user-provided API keys
- No other remote code is executed; all other functionality uses local extension resources

### 3. Scripting Permission

The scripting permission is required to:

- Inject the image selection interface (selection.js) when users want to capture a specific area
- Insert CSS styles for the selection overlay and highlighting
- Execute necessary content scripts for screenshot functionality
- This permission is fundamental to providing an interactive screenshot selection experience

### 4. Storage Permission

The storage permission is required to:

- Store user's OpenAI API key securely using chrome.storage.sync
- Save analysis history and results for the gallery feature
- Maintain user preferences like analysis role settings
- This permission enables persistent storage of user data and settings across sessions

## Data Usage Compliance

- The extension only captures screenshots when explicitly initiated by the user
- Screenshots are processed locally and only sent to OpenAI's API for analysis with user consent
- User's API keys are stored securely using Chrome's storage API
- No user data is collected or shared with third parties other than OpenAI for image analysis
- All functionality complies with Chrome Web Store's Developer Program Policies
