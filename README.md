# 📚 Kindle Book Reader

A modern, mobile-first PDF book reader with an intuitive interface and class-based organization. Built with vanilla JavaScript, HTML5, and CSS3 for optimal performance across all devices.

## ✨ Features

### 📱 Mobile-First Design
- **Responsive Layout**: Optimized for mobile, tablet, and desktop
- **Touch Gestures**: Swipe left/right to navigate pages
- **Mobile-Optimized Controls**: Thumb-friendly button placement
- **Full-Screen Reading**: Immersive reading experience on mobile devices

### 🎨 Modern UI/UX
- **Glassmorphism Design**: Beautiful backdrop blur effects
- **Smooth Animations**: CSS transitions and transforms
- **Dark Mode Support**: Automatic theme switching based on system preference
- **Accessibility**: Keyboard navigation and screen reader support

### 📖 Reading Experience
- **3D Page Flipping**: Smooth page transitions with PageFlip.js
- **Zoom Controls**: Pinch to zoom and button controls
- **Text-to-Speech**: Built-in speech synthesis
- **Page Navigation**: Previous/Next buttons and page counter
- **Fullscreen Mode**: Distraction-free reading

### 🔍 Smart Organization
- **Class-Based Structure**: Books organized by academic class
- **Search Functionality**: Find books by title, author, or class
- **Book Details Modal**: View book information before reading
- **Download Support**: Download PDFs for offline reading

### 🚀 Performance & PWA
- **Service Worker**: Offline functionality and caching
- **Progressive Web App**: Installable on mobile devices
- **Optimized Rendering**: Efficient PDF loading and display
- **Touch Optimized**: Smooth scrolling and gesture handling

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **PDF Rendering**: PDF.js + PageFlip.js
- **Styling**: CSS3 with CSS Grid and Flexbox
- **PWA**: Service Worker + Web App Manifest
- **Responsive**: Mobile-first CSS with media queries

## 📱 Mobile Optimizations

### Touch Interactions
- Swipe gestures for page navigation
- Touch-friendly button sizes (44px minimum)
- Optimized touch targets for mobile devices
- Smooth scrolling with momentum

### Layout Adaptations
- Single-column layout on mobile
- Full-screen reading mode
- Collapsible navigation
- Thumb-accessible controls

### Performance
- Optimized for mobile processors
- Reduced animations on low-end devices
- Efficient memory usage
- Fast PDF rendering

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kindle_book
   ```

2. **Open in browser**
   - Simply open `index.html` in a modern web browser
   - For PWA features, serve via HTTPS

3. **Add your books**
   - Place PDF files in the `books/` directory
   - Update `books.json` with book information
   - Organize by class structure

## 📁 Project Structure

```
kindle_book/
├── index.html          # Main application
├── style.css           # Responsive styles
├── app.js             # Application logic
├── books.json         # Book library data
├── manifest.json      # PWA manifest
├── sw.js             # Service worker
├── favicon.svg       # App icon
└── books/            # PDF book files
    ├── class 6/      # Class 6 materials
    ├── class 8/      # Class 8 materials
    ├── class 9/      # Class 9 materials
    ├── class 10/     # Class 10 materials
    └── class 12/     # Class 12 materials
```

## 📱 Mobile Testing

### Responsive Breakpoints
- **Mobile**: < 768px (single column, full-screen reading)
- **Tablet**: 768px - 1024px (adaptive layout)
- **Desktop**: > 1024px (multi-column, enhanced controls)

### Touch Testing
- Test swipe gestures on mobile devices
- Verify button sizes meet accessibility guidelines
- Check touch response times
- Test in different orientations

## 🎯 Browser Support

- **Chrome**: 60+ (Full support)
- **Firefox**: 55+ (Full support)
- **Safari**: 12+ (Full support)
- **Edge**: 79+ (Full support)
- **Mobile Browsers**: iOS Safari, Chrome Mobile, Samsung Internet

## 🔧 Customization

### Adding New Classes
1. Create a new directory in `books/`
2. Add PDF files
3. Update `books.json` with class information

### Styling
- Modify `style.css` for custom themes
- Adjust breakpoints in media queries
- Customize color schemes and animations

### Functionality
- Extend `app.js` with new features
- Add new event listeners
- Implement additional PDF controls

## 📊 Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## 🐛 Troubleshooting

### Common Issues
1. **PDFs not loading**: Check file paths in `books.json`
2. **Touch gestures not working**: Ensure mobile device and touch events enabled
3. **PWA not installing**: Verify HTTPS and valid manifest
4. **Performance issues**: Check device capabilities and PDF file sizes

### Debug Mode
- Open browser developer tools
- Check console for error messages
- Verify service worker registration
- Test responsive design with device simulation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on multiple devices
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **PageFlip.js** for 3D page flipping
- **PDF.js** for PDF rendering
- **CSS Grid & Flexbox** for responsive layouts
- **Modern Web APIs** for PWA functionality

---

**Built with ❤️ for mobile-first reading experience**
