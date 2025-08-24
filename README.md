# 📚 Kindle Book Reader

A modern, mobile-first web application for reading PDF books organized by class. Built with vanilla JavaScript, PDF.js, and StPageFlip for smooth 3D page turning.

## ✨ Features

- **Class-based Organization**: Books are grouped by class (Class 6-12) in a clean, organized layout
- **Mobile-First Design**: Responsive design that works perfectly on all devices
- **3D Page Flipping**: Smooth, realistic page turning using StPageFlip
- **Text-to-Speech**: Built-in TTS with play/pause/resume and auto-continue to next page
- **Touch Support**: Swipe gestures for mobile devices
- **Keyboard Navigation**: Arrow keys, spacebar, and escape key support
- **Optimized Rendering**: Progressive page rendering with pre-loading of current/next/prev pages
- **No Backend Required**: Runs entirely in the browser with static hosting support

## 🚀 Quick Start

### Option 1: Local Development Server

1. **Python 3** (recommended):
   ```bash
   python -m http.server 8000
   ```

2. **Node.js**:
   ```bash
   npx http-server
   ```

3. **PHP**:
   ```bash
   php -S localhost:8000
   ```

4. **VS Code Live Server**: Install the "Live Server" extension and right-click `index.html`

### Option 2: Deploy to Static Hosting

- **Vercel**: Drag and drop the folder to [vercel.com](https://vercel.com)
- **GitHub Pages**: Push to a GitHub repository and enable Pages
- **Netlify**: Drag and drop the folder to [netlify.com](https://netlify.com)

## 📁 Project Structure

```
kindle_book/
├── index.html          # Main HTML file
├── style.css           # Styles and responsive design
├── app.js              # Main application logic
├── books.json          # Book manifest organized by class
├── books/              # PDF files organized by class
│   ├── class 6/
│   ├── class 7/
│   ├── class 8/
│   ├── class 9/
│   ├── class 10/
│   └── class 12/
├── favicon.svg         # App icon
└── README.md           # This file
```

## 📖 Usage

### Library View
- Browse books organized by class
- Click on any book card to open it in the reader
- Each book shows a generated cover with title and author

### Reader View
- **Navigation**: Use arrow buttons, arrow keys, or swipe gestures
- **Page Jump**: Use the slider on desktop to jump to specific pages
- **Text-to-Speech**: Click play button to start reading aloud
- **Auto-continue**: TTS automatically moves to the next page when finished
- **Resume**: TTS remembers where you paused and resumes from that point

### Controls

#### Mobile
- **Bottom Controls**: Previous, Play/Pause, Stop, Next buttons
- **Swipe**: Left/right swipe to turn pages
- **Touch**: Tap buttons for navigation

#### Desktop
- **Centered Controls**: Large navigation buttons with page slider
- **Keyboard**: 
  - `←` `→` Arrow keys for page navigation
  - `Spacebar` for TTS play/pause
  - `Escape` to return to library

## 🔧 Configuration

### Adding New Books

1. Place PDF files in the appropriate class folder under `books/`
2. Update `books.json` with the new book information:

```json
{
  "class": "Class 10",
  "books": [
    {
      "title": "New Book Title",
      "file": "books/class 10/newbook.pdf",
      "author": "Author Name",
      "year": "2025"
    }
  ]
}
```

### Customizing Classes

Edit the class order in `books.json`. The current order (top to bottom) is:
1. Class 12
2. Class 10  
3. Class 9
4. Class 8
5. Class 7
6. Class 6

## 🎨 Customization

### Colors
The app uses a beautiful gradient theme. To customize colors, edit the CSS variables in `style.css`:

```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Rendering Quality
Adjust the rendering scale in `app.js`:

```javascript
const RENDER_SCALE = 1.5; // Increase for higher quality, decrease for performance
```

### Preload Pages
Modify the number of pages to pre-render:

```javascript
const PRELOAD_PAGES = 3; // More pages = faster initial experience, more memory usage
```

## 🌐 Browser Support

- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Mobile**: iOS Safari 13+, Chrome Mobile 80+, Samsung Internet 10+
- **Features**:
  - PDF.js: All modern browsers
  - StPageFlip: All modern browsers
  - Text-to-Speech: Most modern browsers (varies by OS)
  - Touch/Swipe: All touch devices

## 📱 Mobile Optimization

- **Responsive Design**: Adapts to all screen sizes
- **Touch Gestures**: Swipe left/right to turn pages
- **Bottom Controls**: Easy thumb access on mobile devices
- **Progressive Loading**: Optimized for slower mobile connections
- **Viewport Optimization**: Proper mobile viewport settings

## 🚀 Performance Features

- **Progressive Rendering**: Pages render as needed
- **Background Processing**: Non-blocking page rendering
- **Memory Management**: Automatic cleanup of rendered pages
- **CDN Resources**: PDF.js and StPageFlip loaded from CDN
- **Optimized Images**: JPEG compression for faster loading

## 🔒 Security & Privacy

- **No Data Collection**: App runs entirely in your browser
- **Local Processing**: PDFs are processed locally, not uploaded
- **CORS Safe**: Uses relative paths to avoid cross-origin issues
- **No Tracking**: No analytics or external tracking

## 🐛 Troubleshooting

### Common Issues

1. **PDFs won't load**: Ensure PDFs are in the correct folder structure
2. **TTS not working**: Check browser permissions for speech synthesis
3. **Slow rendering**: Reduce `RENDER_SCALE` in `app.js`
4. **Mobile issues**: Ensure proper viewport meta tag is present

### Debug Mode

Open browser console (F12) to see detailed error messages and performance information.

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome! The code is clean, well-commented, and follows modern JavaScript best practices.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- **PDF.js**: Mozilla's PDF rendering library
- **StPageFlip**: Beautiful 3D page flipping library
- **Modern CSS**: Uses cutting-edge CSS features for beautiful design
- **Vanilla JavaScript**: No frameworks, just pure web standards

---

**Happy Reading! 📚✨**
