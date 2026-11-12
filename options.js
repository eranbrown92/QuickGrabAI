import { mountSettings } from './settings-ui.js';
import { status } from './ui.js';
mountSettings(document.getElementById('settingsForm')).catch(error => status(error.message, true));
