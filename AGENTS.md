# AGENTS.md

> **Project Context for AI Coding Agents**
> This file provides specific instructions, commands, and boundaries for AI agents working on the Digitalizador de Criptogramas project.

***

## Project Overview

**Name:** Digitalizador de Criptogramas (Cryptogram Digitizer)
**Type:** Single Page Application (SPA) - Vanilla JavaScript
**Purpose:** Digitize physical cryptogram puzzles from photos and provide an interactive interface for symbol-to-letter mapping.

**Tech Stack:**

- JavaScript ES6+ (native modules, no transpilation)
- HTML5 Canvas API (image processing)
- CSS3 with Custom Properties (no preprocessors)
- sessionStorage API (temporary data persistence)

**Key Constraint:** No build tools, no frameworks. This is intentionally vanilla JS for educational purposes and full control.

***

## Commands

```bash
# Development
# Open index.html directly in browser (no server needed for basic functionality)
open index.html  # macOS
start index.html # Windows
xdg-open index.html # Linux

# Testing (manual - no test framework yet)
# 1. Open browser dev tools (F12)
# 2. Check console for "🚀 Iniciando Digitalizador de Criptogramas..."
# 3. Follow test steps in NEXT_STEPS.md

# Code Quality
# No linters configured yet - follow code style below

# Clean storage (when debugging)
# Open browser console and run:
sessionStorage.clear(); location.reload();
```


***

## Project Structure

```
digitalizador-criptograma/
├── index.html                    # Entry point - app shell
│
├── css/
│   ├── reset.css                # CSS reset (box-sizing, margins)
│   ├── variables.css            # CSS custom properties (colors, spacing)
│   ├── layout.css               # Global layout (container, nav, grid)
│   └── components.css           # UI components (buttons, cards, dialogs)
│
├── js/
│   ├── app.js                   # Router + app initialization
│   │
│   ├── pages/                   # Page components (SPA)
│   │   ├── UploadPage.js       # Step 1: Image upload with drag-drop
│   │   ├── ProcessingPage.js   # Step 2: Image processing (currently mock)
│   │   └── MappingPage.js      # Step 3: Symbol→letter mapping
│   │
│   ├── utils/                   # Utility functions
│   │   ├── storage.js          # sessionStorage wrapper with error handling
│   │   └── helpers.js          # Image conversion, download, formatting
│   │
│   └── processing/              # Image processing algorithms
│       ├── imageProcessor.js   # Grayscale, binarization, filters
│       ├── gridDetector.js     # Table grid detection (line detection)
│       └── symbolExtractor.js  # Symbol extraction and classification
│
├── AGENTS.md                    # This file
├── NEXT_STEPS.md               # Development roadmap
└── README.md                   # User documentation (to be created)
```


### File Purposes

**Read before modifying:**

- `js/app.js` - Routing logic (hash-based SPA)
- `js/pages/*.js` - Page lifecycle: render() → attachEvents() → destroy()

**Write new features to:**

- `js/processing/` - New image processing algorithms
- `js/utils/` - New utility functions
- `css/components.css` - New UI components

**Never modify:**

- `css/reset.css` - Standard CSS reset
- Files in `node_modules/` (doesn't exist yet)

***

## Code Style

### Naming Conventions

```javascript
// Variables and Functions: camelCase
const imageData = getImageData();
function handleFileSelect(file) { }

// Classes: PascalCase
class UploadPage { }

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// CSS Classes: kebab-case
.symbol-card { }
.primary-button { }

// Files: camelCase.js
imageProcessor.js
```


### Module Pattern

```javascript
// ✅ Good - ES6 module with exports
// File: utils/helpers.js
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Import in another file
import { formatFileSize } from '../utils/helpers.js';

// ❌ Bad - global functions
function formatFileSize(bytes) { }
window.formatFileSize = formatFileSize;
```


### Page Component Pattern

```javascript
// ✅ Good - Page component structure
export class PageName {
  constructor(container) {
    this.container = container;
    this.state = {}; // Component state
    
    this.render();
    this.attachEvents();
  }
  
  render() {
    this.container.innerHTML = `<!-- HTML template -->`;
  }
  
  attachEvents() {
    // Event listeners
    document.getElementById('button').addEventListener('click', () => {
      this.handleAction();
    });
  }
  
  handleAction() {
    // Business logic
  }
  
  destroy() {
    // Cleanup (remove listeners if needed)
  }
}

// ❌ Bad - no structure
function renderPage() {
  document.body.innerHTML = '...';
}
```


### Function Documentation

```javascript
// ✅ Good - JSDoc style for complex functions
/**
 * Converts base64 string to ImageData
 * @param {string} base64 - Base64 encoded image string
 * @returns {Promise<ImageData>} ImageData object
 * @throws {Error} If image fails to load
 */
export function convertBase64ToImageData(base64) {
  return new Promise((resolve, reject) => {
    // Implementation
  });
}

// ✅ Good - simple comment for obvious functions
// Format bytes to human-readable string (e.g., "2.5 MB")
export function formatFileSize(bytes) { }

// ❌ Bad - no documentation for complex logic
export function preprocessImage(imageData) {
  // 50 lines of algorithm with no explanation
}
```


### Error Handling

```javascript
// ✅ Good - specific error handling
try {
  const data = await processImage(imageData);
  saveToStorage('processedData', JSON.stringify(data));
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    alert('Image too large for storage. Try a smaller image.');
  } else {
    console.error('Processing failed:', error);
    alert('Processing failed. Check console for details.');
  }
}

// ❌ Bad - silent failures
try {
  await processImage(imageData);
} catch (error) {
  // Nothing
}
```


***

## Current Status

### Working Features (MVP)

- ✅ Image upload (drag-drop + click)
- ✅ Image preview with file info
- ✅ Mock processing simulation (progress bar, 5 stages)
- ✅ Mock symbol generation (10 symbols A-J)
- ✅ Interactive symbol mapping (click → dialog → save)
- ✅ Progress tracking (X/Y symbols mapped)
- ✅ JSON export of mappings
- ✅ Hash-based routing (\#upload, \#processing, \#mapping)


### Not Yet Implemented

- ❌ **Real image processing** - Currently uses mock data
- ❌ Real grid detection - Functions exist but not integrated
- ❌ Real symbol extraction - Functions exist but not integrated
- ❌ OCR for clues - No text recognition
- ❌ Data persistence - Lost on page refresh (sessionStorage only)
- ❌ Mobile responsiveness - Desktop-first design
- ❌ Dark mode
- ❌ Loading states for file reading
- ❌ Image size validation before processing


### Integration Needed

**To enable real processing, modify `js/pages/ProcessingPage.js`:**

```javascript
// Current (mock):
async processImage() {
  // Simulated stages
  this.processedData = this.generateMockData();
}

// Replace with (real):
async processImage() {
  const { preprocessImage } = await import('../processing/imageProcessor.js');
  const { detectGrid } = await import('../processing/gridDetector.js');
  const { extractSymbols } = await import('../processing/symbolExtractor.js');
  
  // Step 1: Preprocess
  this.updateStatus('preprocessing', 20, 'Applying binarization...');
  const binary = preprocessImage(this.imageData);
  
  // Step 2: Detect grid
  this.updateStatus('detecting', 40, 'Detecting table grid...');
  const grid = detectGrid(binary);
  
  // Step 3: Extract symbols
  this.updateStatus('extracting', 80, 'Extracting symbols...');
  const symbols = extractSymbols(binary, grid);
  
  this.processedData = {
    tableStructure: { rows: grid.rows, cols: grid.cols },
    clues: [], // OCR not implemented yet
    extractedSymbols: symbols.extracted.length,
    uniqueSymbols: symbols.unique
  };
}
```


***

## Git Workflow

### Commit Messages

```bash
# ✅ Good - specific, actionable
git commit -m "Add median filter to imageProcessor"
git commit -m "Fix symbol comparison threshold in symbolExtractor"
git commit -m "Integrate real grid detection into ProcessingPage"

# ❌ Bad - vague
git commit -m "Update code"
git commit -m "Fix bug"
```


### Branch Strategy

```bash
# Feature branches
git checkout -b feature/ocr-integration
git checkout -b feature/dark-mode
git checkout -b fix/storage-quota-handling

# Merge to main when tested
git checkout main
git merge feature/ocr-integration
```


***

## Boundaries

### ✅ Always Do

- **Run manual tests** after changes (no automated tests yet)
- **Check browser console** for errors before committing
- **Update AGENTS.md** if you change architecture or add major features
- **Use ES6 modules** - every file exports/imports explicitly
- **Handle errors** - wrap risky operations in try-catch
- **Validate user input** - check file types, sizes, letter inputs
- **Update sessionStorage keys** in AGENTS.md if you add new ones
- **Test in Chrome/Firefox** - this is the primary target


### ⚠️ Ask First

- **Adding external libraries** - project is vanilla JS by design
- **Changing file structure** - keep current organization
- **Modifying CSS architecture** - variables → layout → components pattern
- **Changing routing approach** - currently hash-based for simplicity
- **Adding build tools** - defeats educational purpose
- **Database or backend integration** - this is frontend-only


### 🚫 Never Do

- **Commit API keys or secrets** - project is client-side only but still avoid
- **Remove mock functions before real ones work** - keep fallbacks
- **Modify uploaded images destructively** - always work on copies
- **Use `eval()` or unsafe DOM methods** - security risk
- **Hardcode file paths** - use relative imports
- **Break ES6 module pattern** - no global variables
- **Remove error handling** - always keep try-catch where it exists
- **Use jQuery or similar** - vanilla JS only

***

## sessionStorage Keys

**Current keys in use:**


| Key | Type | Set By | Read By | Purpose |
| :-- | :-- | :-- | :-- | :-- |
| `uploadedImagePreview` | String (base64) | UploadPage | ProcessingPage | Original uploaded image |
| `uploadedImageName` | String | UploadPage | ProcessingPage | Original filename |
| `processedSymbols` | String (JSON) | ProcessingPage | MappingPage | Array of extracted symbols |
| `symbolMapping` | String (JSON) | MappingPage | MappingPage | Object mapping symbol IDs to letters |

**If you add new keys:**

1. Add to table above
2. Use descriptive camelCase names
3. Always stringify objects before storing
4. Handle JSON.parse errors when reading

***

## Testing Approach

### Manual Testing Checklist

**Before committing changes to pages:**

```javascript
// 1. UploadPage
- [ ] Drag-drop works
- [ ] Click to upload works
- [ ] Preview shows correctly
- [ ] File size displays
- [ ] Remove button clears preview
- [ ] Process button navigates to #processing

// 2. ProcessingPage
- [ ] Image loads from storage
- [ ] Progress bar animates 0→100%
- [ ] All 5 stages show
- [ ] Canvas displays image
- [ ] Results card appears
- [ ] Continue button navigates to #mapping

// 3. MappingPage
- [ ] Symbols grid renders
- [ ] Click opens dialog
- [ ] Letter input accepts A-Z only
- [ ] Save updates grid
- [ ] Progress bar updates
- [ ] Mapping table populates
- [ ] Export downloads JSON
- [ ] Reset clears all mappings
```

**Console commands for debugging:**

```javascript
// View current storage
Object.keys(sessionStorage).forEach(key => {
  console.log(key, sessionStorage.getItem(key).substring(0, 100));
});

// Clear and restart
sessionStorage.clear(); 
location.reload();

// Jump to specific page
window.location.hash = 'mapping';

// Check routing
console.log('Current route:', window.location.hash);
```


***

## Common Tasks

### Adding a New Page

```javascript
// 1. Create file: js/pages/NewPage.js
export class NewPage {
  constructor(container) {
    this.container = container;
    this.render();
    this.attachEvents();
  }
  
  render() {
    this.container.innerHTML = `<h1>New Page</h1>`;
  }
  
  attachEvents() { }
  
  destroy() { }
}

// 2. Register in js/app.js
import { NewPage } from './pages/NewPage.js';

this.routes = {
  'new': this.renderNewPage.bind(this),
  // ... other routes
};

renderNewPage() {
  this.root.innerHTML = '';
  this.currentPage = new NewPage(this.root);
}

// 3. Add navigation link in index.html
<a href="#new" class="nav-link">New</a>
```


### Adding a New Utility Function

```javascript
// 1. Add to js/utils/helpers.js
/**
 * Brief description
 * @param {Type} param - Description
 * @returns {Type} Description
 */
export function newUtilityFunction(param) {
  // Implementation
  return result;
}

// 2. Import where needed
import { newUtilityFunction } from '../utils/helpers.js';

// 3. Use it
const result = newUtilityFunction(data);
```


### Adding a New CSS Component

```css
/* In css/components.css */

/* ===================================
   COMPONENT NAME
   =================================== */

.component-name {
  /* Use variables from variables.css */
  background: var(--primary);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
  transition: var(--transition);
}

.component-name:hover {
  background: var(--primary-dark);
}

.component-name.modifier {
  /* Modifiers/states */
}
```


***

## Known Issues

1. **QuotaExceededError** - Large images (>2MB) may exceed sessionStorage limit
    - Mitigation: Added in storage.js, automatically clears old data
    - TODO: Resize images before storing
2. **Mock data mismatch** - ProcessingPage generates 10 symbols but real processing may find different amounts
    - TODO: Replace mock data with real processing
3. **No mobile support** - UI breaks on small screens
    - TODO: Add responsive breakpoints
4. **Canvas memory** - Multiple large canvases can slow performance
    - TODO: Reuse canvas contexts, dispose when done
5. **No input validation** - File size not checked before processing
    - TODO: Add MAX_FILE_SIZE constant and validate

***

## Next Development Steps

**Priority 1 (This Week):**

1. Integrate real image processing (replace mocks in ProcessingPage)
2. Add file size validation before upload
3. Add loading spinner during file read
4. Test with real cryptogram images

**Priority 2 (Next Week):**
5. Add localStorage persistence for mappings
6. Implement basic mobile layout
7. Add keyboard shortcuts (Esc to close dialog, Enter to save)
8. Create README.md with screenshots

**Priority 3 (Future):**
9. Integrate Tesseract.js for OCR
10. Add dark mode toggle
11. Implement undo/redo for mappings
12. Add image zoom/pan controls

See `NEXT_STEPS.md` for detailed roadmap.

***

## Quick Reference

```javascript
// Navigate programmatically
import { navigate } from './app.js';
navigate('mapping');

// Storage operations
import { saveToStorage, getFromStorage } from './utils/storage.js';
saveToStorage('key', 'value');
const value = getFromStorage('key');

// Image conversion
import { convertBase64ToImageData } from './utils/helpers.js';
const imageData = await convertBase64ToImageData(base64String);

// Download JSON
import { downloadJSON } from './utils/helpers.js';
downloadJSON(dataObject, 'filename.json');
```


***

## Questions?

**"Why no frameworks?"**
Educational purpose - learn fundamentals before abstractions.

**"Why sessionStorage not localStorage?"**
Temporary by design - cryptogram solving is a session activity.

**"Why hash routing?"**
Simplest SPA routing without server config.

**"Can I add TypeScript?"**
Ask first - adds complexity counter to project goals.

**"Can I add a bundler?"**
Ask first - project uses native ES6 modules intentionally.

***

*Last updated: 2026-02-05*
*Project status: MVP with mock processing - Ready for real algorithm integration*
