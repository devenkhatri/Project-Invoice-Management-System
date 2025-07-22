# Project Invoice Management System Documentation

This directory contains the Docusaurus-based documentation for the Project Invoice Management System.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run start
   ```

3. Build the documentation:
   ```bash
   npm run build
   ```

4. Serve the built documentation:
   ```bash
   npm run serve
   ```

## Documentation Structure

- `docs/` - Main documentation content
  - `getting-started/` - Getting started guides
  - `user-guide/` - User guides for different features
  - `api/` - API documentation
  - `admin/` - Administration guides
  - `troubleshooting/` - Troubleshooting guides
- `src/` - Docusaurus custom components
- `static/` - Static assets like images
- `docusaurus.config.js` - Docusaurus configuration
- `sidebars.js` - Sidebar configuration

## Contributing to Documentation

1. Create or edit markdown files in the `docs/` directory
2. Use the following front matter at the top of each markdown file:
   ```
   ---
   id: unique-id
   title: Page Title
   sidebar_label: Sidebar Label
   ---
   ```
3. Add the page to the appropriate sidebar in `sidebars.js`
4. Run the development server to preview changes