# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QuickGrabAI is a Chrome extension (Manifest V3) that enables users to capture screenshots of web content and analyze them using OpenAI's vision-capable models. The extension provides a comprehensive interface for model selection, pricing display, and academic test-taking assistance.

## Architecture

### Core Components

- **manifest.json**: Extension configuration with permissions for activeTab, scripting, and storage
- **popup.js/popup.html**: Main interface with tabbed UI (Capture, Gallery, Settings) including dynamic model selection and pricing display
- **background.js**: Service worker handling tab capture and message routing
- **content scripts**: Injected for screenshot selection functionality
  - **selection.js**: Interactive overlay for area selection with mouse events and cleanup
  - **api.js**: Handles OpenAI API communication with dynamic model selection
- **analysis.js/analysis.html**: Dedicated page for displaying analysis results with gallery management
- **get-models.js**: Utility script for fetching available OpenAI models via API

### Data Flow

1. User selects model and analysis mode in settings → stored in Chrome sync storage
2. User clicks capture → popup.js captures visible tab with selected model context
3. Injects selection.js for interactive area selection with escape key handling
4. Cropped image sent to background.js → opens analysis.html with model/role parameters
5. analysis.js retrieves selected model from storage and calls OpenAI API dynamically
6. Results stored in localStorage with model metadata and displayed

### Storage Architecture

- **Chrome Sync Storage**: 
  - `apiKey`: OpenAI API key (masked display, secure storage)
  - `selectedModel`: Currently selected OpenAI model ID (defaults to gpt-5-2025-08-07)
  - `analysisRole`: Analysis mode (image_analysis or test_taker)
- **localStorage**: 
  - `quickgrabai_entries`: Array of analysis history with timestamps, images (base64), analysis text, and model used
  - `quickgrabai_selected`: Temporary single item for cross-page communication

### AI Integration & Model Support

- **Dynamic Model Selection**: Supports 18+ OpenAI vision-capable models organized by series
- **Model Categories**:
  - GPT-5 series (latest, best performance): gpt-5, gpt-5-mini, gpt-5-nano variants
  - GPT-4.1 series: gpt-4.1, gpt-4.1-mini, gpt-4.1-nano
  - GPT-4o series: gpt-4o, gpt-4o-mini, chatgpt-4o-latest
  - GPT-4 Turbo and Classic variants
- **Pricing Integration**: Real-time pricing display per 1M tokens (input/output) with affordability indicators
- **Analysis Modes**:
  - **image_analysis**: General 1-2 sentence descriptions with test question detection
  - **test_taker**: Comprehensive academic assistant for all subjects (math, science, history, etc.) with step-by-step reasoning
- **Model Selection Logic**: analysis.js dynamically retrieves selectedModel from storage before API calls

## Development Commands

This is a standard Chrome extension with no build process - files are loaded directly.

### Testing the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"  
3. Click "Load unpacked" and select the project directory
4. Test functionality requires a valid OpenAI API key

### Model Management

- **Fetch Available Models**: Run `node get-models.js` to retrieve current OpenAI models
- **Update Model List**: Modify `popup.html` optgroup sections with new models and pricing
- **Pricing Updates**: Update `data-pricing` attributes in `popup.html` when OpenAI changes pricing

## Key Implementation Details

### Settings UI Architecture

- **Model Selection**: Uses grouped `<select>` with `<optgroup>` organization by model series
- **Dynamic Pricing**: JavaScript updates pricing display in real-time based on `data-pricing` attributes
- **API Key Management**: Secure storage with masked display and direct link to OpenAI platform

### Test Taker Mode Enhancement

The `getPromptForRole()` function in analysis.js contains the comprehensive academic prompt:
- Supports all academic subjects (math, science, history, literature, etc.)
- Provides step-by-step reasoning for complex problems
- Handles multiple choice questions with clear answer format
- Designed for educational use across grade levels

### Chrome Extension Specific Notes

- Cannot capture on `chrome://` or `edge://` system pages
- Uses Chrome APIs: `tabs.captureVisibleTab`, `scripting.executeScript`, `storage.sync`
- Content Security Policy restricts script execution to 'self'  
- Web accessible resources: `api.js` and `selection.js` for content script injection
- Model selection persists across sessions via Chrome sync storage

### UI/UX Features

- Clean text-based interface (no emojis to avoid encoding issues)
- Real-time pricing feedback with affordability indicators
- Professional footer with creator attribution
- Direct link to OpenAI API key creation for new users