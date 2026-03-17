import { a as reactExports, j as jsxRuntimeExports, c as ReactDOM, R as React } from "./client-DcIF_kx-.js";
const SIZE_MAP = {
  sm: "2.5rem",
  md: "3.5rem",
  lg: "4.5rem",
  xl: "6rem"
};
const POSITION_MAP = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end"
};
const FONT_MAP = {
  rounded: '"Nunito", "Segoe UI", sans-serif',
  "bold-condensed": '"Barlow Condensed", "Arial Narrow", sans-serif',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif'
};
function VideoOverlay() {
  const videoRef = reactExports.useRef(null);
  const [lines, setLines] = reactExports.useState([]);
  const [textStyle, setTextStyle] = reactExports.useState({
    size: "lg",
    color: "#FFFFFF",
    position: "bottom",
    shadow: true
  });
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
  reactExports.useEffect(() => {
    if (!videoRef.current) return;
    if (videoPath) {
      videoRef.current.src = `file:///${videoPath.replace(/\\/g, "/")}`;
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.load();
    }
  }, [videoPath]);
  const fontSize = SIZE_MAP[textStyle.size ?? "lg"] ?? "4.5rem";
  const justifyContent = POSITION_MAP[textStyle.position ?? "bottom"] ?? "flex-end";
  const fontFamily = FONT_MAP[textStyle.font ?? "sans"] ?? FONT_MAP.sans;
  const fadeDuration = transitionDurationRef.current;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
    width: "100vw",
    height: "100vh",
    position: "relative",
    overflow: "hidden",
    background: "#000"
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "video",
      {
        ref: videoRef,
        loop: true,
        muted: true,
        autoPlay: true,
        playsInline: true,
        style: {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0
        }
      }
    ),
    videoPath && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.3)",
      zIndex: 1
    } }),
    videoPath && textStyle.position === "bottom" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
      zIndex: 2
    } }),
    lines.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
      position: "absolute",
      inset: 0,
      zIndex: 3,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent,
      padding: "4rem 6rem",
      opacity: visible ? 1 : 0,
      transition: `opacity ${fadeDuration}ms ease`
    }, children: lines.map((line, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: {
      color: textStyle.color ?? "#FFFFFF",
      fontSize,
      fontFamily,
      fontWeight: 700,
      lineHeight: 1.25,
      textAlign: "center",
      textShadow: textStyle.shadow ? "0 2px 12px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)" : "none",
      WebkitTextStroke: textStyle.stroke ? "1px rgba(0,0,0,0.5)" : "none",
      marginBottom: "0.5rem",
      textRendering: "optimizeLegibility",
      WebkitFontSmoothing: "antialiased",
      wordBreak: "break-word",
      maxWidth: "100%"
    }, children: line }, i)) }),
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
