import { a as reactExports, D as DEFAULT_SLIDE_STYLE, j as jsxRuntimeExports, S as SlideView, c as ReactDOM, R as React } from "./SlideView-CqN0asXU.js";
function VideoOverlay() {
  const [lines, setLines] = reactExports.useState([]);
  const [textStyle, setTextStyle] = reactExports.useState(DEFAULT_SLIDE_STYLE);
  const [videoPath, setVideoPath] = reactExports.useState(null);
  const [blackout, setBlackout] = reactExports.useState(false);
  const [whiteout, setWhiteout] = reactExports.useState(false);
  const [visible, setVisible] = reactExports.useState(true);
  const transitionDurationRef = reactExports.useRef(250);
  const transitionTypeRef = reactExports.useRef("fade");
  reactExports.useEffect(() => {
    const onShowSection = (payload) => {
      const duration = transitionTypeRef.current === "cut" ? 0 : transitionDurationRef.current;
      setVisible(false);
      setTimeout(() => {
        setLines(payload.lines ?? []);
        if (payload.textStyle) setTextStyle(payload.textStyle);
        setVisible(true);
      }, duration);
    };
    const onSetVideo = (payload) => {
      setVideoPath(payload.videoPath);
    };
    const onBlackout = (payload) => {
      setBlackout(payload.active);
    };
    const onWhiteout = (payload) => {
      setWhiteout(payload.active);
    };
    const onTransition = (payload) => {
      if (payload.type) transitionTypeRef.current = payload.type;
      if (typeof payload.duration === "number") transitionDurationRef.current = payload.duration;
    };
    window.api.on("live:show-section", onShowSection);
    window.api.on("live:set-video", onSetVideo);
    window.api.on("live:blackout", onBlackout);
    window.api.on("live:whiteout", onWhiteout);
    window.api.on("live:transition", onTransition);
    window.api.signalReady();
    return () => {
      window.api.off("live:show-section", onShowSection);
      window.api.off("live:set-video", onSetVideo);
      window.api.off("live:blackout", onBlackout);
      window.api.off("live:whiteout", onWhiteout);
      window.api.off("live:transition", onTransition);
    };
  }, []);
  const videoSrc = videoPath ? `file:///${videoPath.replace(/\\/g, "/")}` : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
    width: "100vw",
    height: "100vh",
    position: "relative",
    overflow: "hidden",
    background: "#000"
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      SlideView,
      {
        lines,
        textStyle,
        videoSrc,
        visible,
        fadeMs: transitionDurationRef.current
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
      position: "absolute",
      inset: 0,
      zIndex: 100,
      background: "#000",
      opacity: blackout ? 1 : 0,
      transition: "opacity 300ms ease",
      pointerEvents: "none"
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
      position: "absolute",
      inset: 0,
      zIndex: 101,
      background: "#fff",
      opacity: whiteout ? 1 : 0,
      transition: "opacity 300ms ease",
      pointerEvents: "none"
    } })
  ] });
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(VideoOverlay, {}) })
);
