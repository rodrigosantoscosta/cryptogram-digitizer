import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { MappingPage } from './pages/MappingPage';
import { TestPage } from './pages/TestPage';
import { PuzzlePage } from './pages/PuzzlePage';

function App() {
  return (
    <BrowserRouter>
      <div style={styles.app}>
        <Navigation />

        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/processing" element={<ProcessingPage />} />
          <Route path="/mapping" element={<MappingPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/puzzle" element={<PuzzlePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function Navigation() {
  const location = useLocation();

  // Não mostrar navegação na página de upload
  if (location.pathname === '/') {
    return null;
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.navContainer}>
        <Link to="/" style={styles.navBrand}>
          🔤 Digitalizador de Criptogramas
        </Link>

        <div style={styles.navLinks}>
          <Link 
            to="/" 
            style={{
              ...styles.navLink,
              ...(location.pathname === '/' ? styles.navLinkActive : {})
            }}
          >
            📸 Upload
          </Link>
          <Link 
            to="/processing" 
            style={{
              ...styles.navLink,
              ...(location.pathname === '/processing' ? styles.navLinkActive : {})
            }}
          >
            ⚙️ Processamento
          </Link>
          <Link 
            to="/mapping" 
            style={{
              ...styles.navLink,
              ...(location.pathname === '/mapping' ? styles.navLinkActive : {})
            }}
          >
            📋 Mapeamento
          </Link>
          <Link 
            to="/puzzle" 
            style={{
              ...styles.navLink,
              ...(location.pathname === '/puzzle' ? styles.navLinkActive : {})
            }}
          >
            🎮 Jogar
          </Link>
        </div>
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#fafafa',
  },
  nav: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '16px 0',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  },
  navContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navBrand: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1a1a1a',
    textDecoration: 'none',
  },
  navLinks: {
    display: 'flex',
    gap: '8px',
  },
  navLink: {
    padding: '8px 16px',
    borderRadius: '6px',
    textDecoration: 'none',
    color: '#666',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  navLinkActive: {
    backgroundColor: '#667eea',
    color: '#fff',
  },
};

export default App;
