import React,{Suspense,lazy} from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import {MotionConfig} from 'framer-motion';
import Portfolio from './pages/Portfolio.jsx';
import {ToastProvider} from './ui.jsx';
import './styles.css';
const Admin=lazy(()=>import('./pages/Admin.jsx'));
class ErrorBoundary extends React.Component {
  state={error:null}; static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<main className="container section"><h1>Something went wrong.</h1><p>Please reload. Your saved cloud data has not been removed.</p><button className="btn" onClick={()=>location.reload()}>Reload</button></main>:this.props.children;}
}
function App(){return <ErrorBoundary><MotionConfig reducedMotion="user"><ToastProvider><BrowserRouter><Suspense fallback={<div className="page-loading" role="status"><span className="spinner"/>Loading workspace…</div>}><Routes><Route path="/" element={<Portfolio/>}/><Route path="/admin/*" element={<Admin/>}/><Route path="*" element={<main className="container section"><p className="eyebrow">404 / OFF THE GRID</p><h1>This page doesn’t exist.</h1><Link className="btn" to="/">Back to portfolio</Link></main>}/></Routes></Suspense></BrowserRouter></ToastProvider></MotionConfig></ErrorBoundary>;}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);