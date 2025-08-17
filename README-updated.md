# UrbanAI Platform

A comprehensive urban analysis platform built with modern web technologies, providing AI-driven insights for sustainable urban development.

## Projects

This monorepo contains two implementations of the Urban AI platform:

### 1. UrbanAI Vue App (`urbanai-app/`)
- **Framework**: Vue 3 with Composition API
- **Styling**: Tailwind CSS v4 with shadcn-vue components
- **Build Tool**: Vite
- **Features**: Interactive maps, building analysis, energy assessments

### 2. UrbanAI React App (`urbanai-app-react/`)
- **Framework**: Next.js 15 with React 18
- **Styling**: Tailwind CSS with shadcn/ui components
- **Features**: Server-side rendering, modern React patterns, similar functionality to Vue app

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies for both projects
npm install

# Or install for individual projects
cd urbanai-app && npm install
cd urbanai-app-react && npm install
```

### Development

```bash
# Run Vue app
npm run dev:vue
# or
cd urbanai-app && npm run dev

# Run React app  
npm run dev:react
# or  
cd urbanai-app-react && npm run dev
```

### Building

```bash
# Build Vue app
npm run build:vue

# Build React app
npm run build:react
```

## Features

Both implementations include:

- **Building Analysis**: Comprehensive energy efficiency analysis
- **Interactive Maps**: 3D visualization of urban environments
- **Energy Assessments**: CO₂ emissions and consumption tracking
- **Sustainability Metrics**: Renovation recommendations and potential savings
- **Modern UI**: Clean, responsive interface with shadcn components

## Technology Stack

### Shared Technologies
- **Styling**: Tailwind CSS
- **Components**: shadcn component library (Vue & React variants)
- **Icons**: Lucide icons
- **TypeScript**: Full type safety

### Vue-Specific
- **Framework**: Vue 3
- **Routing**: Vue Router 4
- **Build**: Vite
- **State Management**: Composables
- **Components**: Reka UI / shadcn-vue

### React-Specific  
- **Framework**: Next.js 15
- **Routing**: App Router
- **Styling**: CSS Modules + Tailwind
- **Components**: shadcn/ui
- **State Management**: React hooks

## Project Structure

```
UrbanAI-App/
├── urbanai-app/                 # Vue implementation
│   ├── src/
│   │   ├── components/         # Vue components
│   │   ├── composables/        # Vue composables
│   │   ├── layouts/           # App layouts
│   │   ├── pages/             # Page components
│   │   └── router/            # Vue Router setup
│   └── package.json
├── urbanai-app-react/          # React implementation  
│   ├── src/
│   │   ├── app/               # Next.js app router
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities
│   └── package.json
└── package.json               # Workspace root
```

## Development Workflow

1. **Choose your stack**: Work with either Vue or React implementation
2. **Component parity**: Both apps maintain similar functionality
3. **Shared design system**: Both use equivalent shadcn components
4. **Independent deployment**: Each app can be deployed separately

## Contributing

1. Ensure changes maintain parity between Vue and React implementations when applicable
2. Follow the established component patterns
3. Use TypeScript for all new code
4. Maintain responsive design principles

## License

[Your chosen license]
