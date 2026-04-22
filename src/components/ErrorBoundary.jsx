import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const { tc = { bg: "#F0F4F8", text: "#333", textLight: "#666" } } = this.props;
      return (
        <div style={{
          minHeight: "100vh",
          background: tc.bg,
          color: tc.text,
          fontFamily: "'Outfit',system-ui,sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: tc.text, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: tc.textLight, maxWidth: 400, marginBottom: 24 }}>
            {this.state.error?.message || "An unexpected error occurred. Please refresh the page."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#2B5070",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
