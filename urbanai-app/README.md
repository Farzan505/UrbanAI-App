# DeCOtwo Platform

A modern web application for urban analysis and energy efficiency visualization, built with Vue 3, TypeScript, and advanced mapping capabilities.

## Features

- 🏙️ **Urban Analysis**: Advanced building and energy analysis tools
- 🗺️ **Interactive Mapping**: ArcGIS integration for 2D/3D visualization
- 📊 **Data Visualization**: Charts and analytics for energy metrics
- 🔍 **Retrofit Analysis**: Building retrofit analysis and recommendations
- 🎨 **Modern UI**: Beautiful, responsive interface with Tailwind CSS
- 🔧 **Component Library**: Custom UI components with Reka UI

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Mapping**: ArcGIS API for JavaScript
- **Charts**: Chart.js with Vue Chart.js
- **UI Components**: Reka UI, Lucide Vue Icons
- **Form Validation**: VeeValidate with Zod
- **State Management**: Vue Composables

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd urbanai-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── analysis/       # Analysis-specific components
│   ├── map/           # Mapping components
│   └── ui/            # UI component library
├── composables/        # Vue composables
├── layouts/           # App layouts
├── pages/             # Page components
├── router/            # Vue Router configuration
└── lib/               # Utilities and helpers
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
