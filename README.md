# 📊 UMAP Label Positioner

An interactive web application for manually positioning cluster labels on UMAP, t-SNE, or any scatter plot. Perfect for when automatic label positioning tools like ggrepel just won't cooperate!

🔗 **[Live Demo](https://yourusername.github.io/umap_labeler/)**

## ✨ Features

- **🎨 Modern Left-Right Layout**: Controls on the left, interactive plot on the right
- **🚀 No Server Required**: Pure client-side application hosted on GitHub Pages
- **🖱️ Interactive Drag & Drop**: Manually position labels exactly where you want them
- **📊 Flexible CSV Input**:
  - Upload any CSV/TSV with numeric columns
  - Auto-detects 2-column files as X/Y coordinates
  - Choose X, Y, and label columns from dropdown menus for multi-column files
- **📏 Multi-Unit Support**:
  - View plot dimensions in pixels, inches, or centimeters
  - Set your preferred unit for easy sizing
- **🎯 Drag-to-Resize**: Resize plot by dragging corner handle or using sliders
- **⚡ Instant Updates**: All changes apply immediately - no "Update" button needed
- **🎨 Customizable Display**:
  - Adjustable plot dimensions (400-2000px)
  - Configurable font size (8-48px)
  - Point size and opacity controls
- **💾 Export Options**:
  - Label positions as CSV table
  - Ready-to-use ggplot2 R code
  - Ready-to-use matplotlib Python code

## 🚀 Quick Start

### 1. Upload Data
- Click "Upload CSV/TSV" and select your file
- **If 2 columns**: Automatically used as X and Y coordinates
- **If more columns**: Choose which columns are X, Y, and labels from dropdowns

### 2. Add Labels (if not in file)
- If your CSV doesn't have labels, enter them manually
- Type one label per line
- Labels will be positioned in a circular layout for you to drag

### 3. Position Labels
- Drag labels to position them over your clusters
- Adjust plot size with sliders or by dragging the corner handle
- Change font size, point size, and opacity in real-time

### 4. Export Results
- Download label positions as CSV
- Download ready-to-use ggplot2 or matplotlib code
- Use the exported code in your analysis pipeline

## 📁 Example Data Format

### Simple 2-Column CSV (coordinates.csv)
```csv
x,y
-5.2,3.1
-5.1,3.3
2.4,-1.2
2.6,-1.4
```

### Multi-Column CSV with Labels (data.csv)
```csv
umap1,umap2,cluster,gene_expression
-5.2,3.1,T-cells,high
-5.1,3.3,T-cells,medium
2.4,-1.2,B-cells,low
2.6,-1.4,B-cells,medium
```
Then select: X = umap1, Y = umap2, Label = cluster

## 🎯 Key Improvements

### 1. Flexible Data Input
- No need for separate coordinate and label files
- Handles any CSV structure with column selection
- Auto-detects simple 2-column files

### 2. Multi-Unit Display
- Switch between px, inch, and cm
- See exact dimensions in your preferred unit
- Perfect for preparing publication-ready figures

### 3. Instant Feedback
- All sliders update the plot immediately
- No need to click "Update" after every change
- Smooth, responsive interaction

### 4. Drag-to-Resize
- Visual resize handle in bottom-right corner
- Real-time dimension updates while dragging
- Synchronized with slider controls

## 🛠️ Development

This is a static web application built with vanilla JavaScript - no build tools required!

### Local Development

Simply open `index.html` in your browser, or run a local server:

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx serve
```

Then visit `http://localhost:8000`

### Project Structure

```
umap_labeler/
├── index.html      # Main HTML with left-right layout
├── style.css       # Modern styling with sidebar
├── app.js          # Application logic with all features
├── examples/       # Sample data files
├── README.md       # This file
├── DEPLOYMENT.md   # GitHub Pages deployment guide
└── LICENSE         # MIT License
```

## 🌐 Deploy to GitHub Pages

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions.

Quick summary:
1. Create a GitHub repository
2. Push your code
3. Enable GitHub Pages in Settings → Pages
4. Access at `https://yourusername.github.io/umap_labeler/`

## 💡 Use Cases

- Fine-tuning UMAP/t-SNE visualizations for publications
- Creating custom cluster annotations for presentations
- Adjusting labels when automatic methods produce overlapping text
- Generating reproducible label positions across different plot sizes
- Quickly iterating on label placement without re-running analysis code
- Working with complex datasets with multiple metadata columns

## 🔧 Technical Details

- **Browser Compatibility**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Dependencies**: None! Pure vanilla JavaScript
- **Data Processing**: All processing happens client-side (your data never leaves your computer)
- **SVG Rendering**: Smooth, scalable graphics with native drag-and-drop
- **Responsive Design**: Works on desktop, tablet, and mobile

## 📝 Tips

- **Auto-Detection**: For quick workflows, use 2-column CSV files that are auto-detected
- **Multi-Column Files**: Add extra metadata columns - the app lets you choose what to use
- **Unit Preference**: Set your preferred unit (inch/cm/px) before finalizing dimensions
- **Drag to Resize**: Use the corner handle for quick visual resizing
- **Label Positioning**:
  - Upload labels in CSV to get centroid-based positions
  - Enter labels manually for cleaner names or when you don't have per-point labels
- **Plot Sizing**: All sliders update immediately - experiment freely!
Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use in your research and publications!

## 🙏 Acknowledgments

Built for the Welch Lab and the computational biology community. May your labels never overlap again! 🎯
