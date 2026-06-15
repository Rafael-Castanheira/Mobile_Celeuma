export function getViewerStyles(colors) {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: ${colors.background}; overflow: hidden; font-family: sans-serif; }
    a-scene { display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

    .viewer-error {
      position: absolute; inset: 0; display: none;
      align-items: center; justify-content: center; text-align: center;
      padding: 24px; color: ${colors.foreground}; background: ${colors.background};
      font-size: 14px; line-height: 20px; z-index: 30;
    }

    .a-enter-vr { display: none !important; }
  </style>
`;
}
