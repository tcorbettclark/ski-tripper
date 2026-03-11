# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Type

This is a Bun-based React web application project. Uses Bun as the runtime and package manager and bundler.

## Development Commands

### Project Setup
```bash
# Initialize the project
bun init

# Add dependencies
bun add react react-dom
bun add -d @types/react @types/react-dom
```

### Development Server
```bash
# Start the development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Architecture

This is a typical React application structure. The application uses bun and vite.

Key concepts:
- **React** is used for the UI components
- **JavaScript** is the main programming language.
