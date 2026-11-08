import { Component } from "react";
import { STARTUP_MESSAGE } from "../bootstrap";

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error("MENRO rendering failed:", error); }
  render() {
    if (this.state.failed) return <section className="startup-panel" role="alert"><h1>Unable to load MENRO</h1><p>{STARTUP_MESSAGE}</p><a href="">Reload page</a></section>;
    return this.props.children;
  }
}
