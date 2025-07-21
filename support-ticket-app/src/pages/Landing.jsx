import { Link } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing-bg">
      <div className="landing-card">
        <h1 className="landing-title">Welcome to Support Portal</h1>
        <p className="landing-desc">Need help? Our AI assistant is ready to assist you. If you need a human, you can escalate at any time.</p>
        <Link to="/support" className="landing-btn">Go to Support</Link>
      </div>
    </div>
  );
} 