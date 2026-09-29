"use client";

export default function PrintButton() {
  return (
    <button className="btn-primary btn-sm" onClick={() => window.print()}>🖨 Print / Save PDF</button>
  );
}
