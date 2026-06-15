import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CryptogramSolver } from './components/CryptogramSolver';
import { GroundTruthValidator } from './pages/GroundTruthValidator';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CryptogramSolver />} />
        <Route path="/ground-truth" element={<GroundTruthValidator />} />
        <Route path="/test" element={<CryptogramSolver />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
