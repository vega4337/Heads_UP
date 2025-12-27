import React from "react";

export default function ScreenShell({ title, subtitle, children }) {
  return (
    <div className="shell">
      <div className="card">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 className="h1">{title}</h1>
            {subtitle ? <p className="p">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
