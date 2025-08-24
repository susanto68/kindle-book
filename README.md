# 📚 SmoothReader - Free Books Library

A modern, responsive web-based PDF reader that provides a Kindle-like reading experience in your browser. Built with vanilla JavaScript, it features smooth page-flipping animations, text-to-speech capabilities, and a beautiful library interface.

## ✨ Features

- **📖 PDF Library**: Access to 30+ classic public domain books
- **🔄 Smooth Page Flipping**: St.PageFlip integration for realistic book animations
- **🎵 Text-to-Speech**: Built-in TTS with play/pause/resume functionality
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **⚡ Progressive Rendering**: Fast initial loading with background quality enhancement
- **🎨 Modern UI**: Beautiful dark theme with smooth animations
- **🔍 Smart Navigation**: Page slider, keyboard shortcuts, and intuitive controls

## 🚀 Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- Internet connection (for loading external PDFs and covers)

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/susanto68/kindle-book.git
   cd kindle-book
   ```

2. Open `index.html` in your browser, or serve locally:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server -p 8000
   ```

3. Navigate to `http://localhost:8000` in your browser

## 📚 Available Books

The library includes classic literature such as:
- **Pride and Prejudice** by Jane Austen
- **Moby Dick** by Herman Melville
- **Frankenstein** by Mary Shelley
- **Alice's Adventures in Wonderland** by Lewis Carroll
- **War and Peace** by Leo Tolstoy
- And 25+ more classic works

## 🎮 Controls

### Library View
- Click any book card to open the reader
- Use the reload button to refresh the book manifest

### Reader Controls
- **Navigation**: Previous/Next buttons or arrow keys
- **Page Jump**: Use the slider to jump to specific pages
- **Text-to-Speech**: Play/Pause/Stop buttons
- **Keyboard Shortcuts**:
  - `←` / `→`: Previous/Next page
  - `Spacebar`: Toggle TTS

## 🛠️ Technical Details

### Built With
- **Frontend**: Vanilla JavaScript (ES6+)
- **PDF Processing**: PDF.js for rendering and text extraction
- **Page Flipping**: St.PageFlip for smooth animations
- **Styling**: Modern CSS with Grid, Flexbox, and CSS Variables
- **External APIs**: OpenLibrary for book covers, Archive.org for PDFs

### Architecture
- **Progressive Rendering**: Quick previews followed by high-quality images
- **Lazy Loading**: Images load only when visible
- **Memory Management**: Efficient page caching and cleanup
- **Error Handling**: Graceful fallbacks for missing resources

## 🌐 Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile Browsers**: Responsive design with touch support

## 📱 Deployment

This project is ready to deploy to:
- **GitHub Pages**: Push to main branch
- **Vercel**: Connect your GitHub repository
- **Netlify**: Drag and drop deployment
- **Any static hosting service**

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **PDF.js**: Mozilla's PDF rendering library
- **St.PageFlip**: Smooth page-flipping animations
- **OpenLibrary**: Book cover images
- **Archive.org**: Public domain PDF sources

## 📞 Support

If you encounter any issues or have questions:
1. Check the browser console for error messages
2. Ensure all external resources are accessible
3. Try refreshing the page or clearing browser cache

---

**Happy Reading! 📖✨**
