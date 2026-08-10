import { createRoot } from 'react-dom/client';
import Page from '../src/app/page';

const container = document.getElementById('root');
if (!container) throw new Error('#root não encontrado');
createRoot(container).render(<Page />);
