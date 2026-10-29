import Link from "next/link";
import { Clapperboard, Home } from "lucide-react";

export default function NotFound() {
  return <main className="landing-shell"><nav className="landing-nav"><div className="frame-logo"><span className="frame-logo-icon"><Clapperboard size={18} /></span><span>FrameFlow <span className="brand-light">Studio</span></span></div></nav><section className="landing-card"><div className="frame-kicker">404 · FRAME NOT FOUND</div><h1>This frame is out of focus.</h1><p className="landing-lead">This page is unavailable or may have moved.</p><Link className="primary" href="/login"><Home size={15} />Return to FrameFlow</Link></section><footer className="landing-bottom">FrameFlow Studio · A private creative workspace</footer></main>;
}
