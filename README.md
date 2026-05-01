# UMAP Label Positioner

Vibe coding project with Codex. An interactive web application for manually positioning cluster labels on UMAP, t-SNE, or any scatter plot. Perfect for when automatic label positioning tools like ggrepel just won't cooperate! The whole thing works on the client side, meaning that user data is never sent out of their own computer. 

🔗 **Live Demo: [https://mvfki.github.io/umap_labeler/](https://mvfki.github.io/umap_labeler/)**

## Features

- **Flexible CSV Input**:
  - Upload any CSV/TSV, each row a dot
  - Auto-detects numeric columns for X/Y coordinates
  - Choose X, Y, and label columns from dropdown menus
- **Interactive Drag & Drop**:
  - Manually position labels exactly where you want them
  - Remove any crowded labels, or rename to satisfaction
  - Add any new labels that do not come with your data
- **Precise Plot Resizing**:
  - Manually resize the plot smoothly
  - Precise unit sizing for practical cases like slide making or publication assembly
- **Instant Updates**: All changes apply immediately - no "Update" button needed
- **Customizable Display**:
  - Font size and color
  - Point size, opacity and color
- **Export Options**:
  - Label positions as CSV table
  - Ready-to-use ggplot2 R code
  - Ready-to-use matplotlib Python code
  - Direct PNG, PDF or SVG
