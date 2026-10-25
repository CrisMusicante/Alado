const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./pptxgen.es-CGqMXVdN.js","./SlideView-CqN0asXU.js"])))=>i.map(i=>d[i]);
import { r as requireReactDom, a as reactExports, R as React, b as requireReact, g as getDefaultExportFromCjs, j as jsxRuntimeExports, S as SlideView, c as ReactDOM } from "./SlideView-CqN0asXU.js";
var reactDomExports = requireReactDom();
function useCombinedRefs() {
  for (var _len = arguments.length, refs = new Array(_len), _key = 0; _key < _len; _key++) {
    refs[_key] = arguments[_key];
  }
  return reactExports.useMemo(
    () => (node) => {
      refs.forEach((ref) => ref(node));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs
  );
}
const canUseDOM = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
function isWindow(element) {
  const elementString = Object.prototype.toString.call(element);
  return elementString === "[object Window]" || // In Electron context the Window object serializes to [object global]
  elementString === "[object global]";
}
function isNode(node) {
  return "nodeType" in node;
}
function getWindow(target) {
  var _target$ownerDocument, _target$ownerDocument2;
  if (!target) {
    return window;
  }
  if (isWindow(target)) {
    return target;
  }
  if (!isNode(target)) {
    return window;
  }
  return (_target$ownerDocument = (_target$ownerDocument2 = target.ownerDocument) == null ? void 0 : _target$ownerDocument2.defaultView) != null ? _target$ownerDocument : window;
}
function isDocument(node) {
  const {
    Document
  } = getWindow(node);
  return node instanceof Document;
}
function isHTMLElement(node) {
  if (isWindow(node)) {
    return false;
  }
  return node instanceof getWindow(node).HTMLElement;
}
function isSVGElement(node) {
  return node instanceof getWindow(node).SVGElement;
}
function getOwnerDocument(target) {
  if (!target) {
    return document;
  }
  if (isWindow(target)) {
    return target.document;
  }
  if (!isNode(target)) {
    return document;
  }
  if (isDocument(target)) {
    return target;
  }
  if (isHTMLElement(target) || isSVGElement(target)) {
    return target.ownerDocument;
  }
  return document;
}
const useIsomorphicLayoutEffect = canUseDOM ? reactExports.useLayoutEffect : reactExports.useEffect;
function useEvent(handler) {
  const handlerRef = reactExports.useRef(handler);
  useIsomorphicLayoutEffect(() => {
    handlerRef.current = handler;
  });
  return reactExports.useCallback(function() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return handlerRef.current == null ? void 0 : handlerRef.current(...args);
  }, []);
}
function useInterval() {
  const intervalRef = reactExports.useRef(null);
  const set = reactExports.useCallback((listener, duration) => {
    intervalRef.current = setInterval(listener, duration);
  }, []);
  const clear = reactExports.useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  return [set, clear];
}
function useLatestValue(value, dependencies) {
  if (dependencies === void 0) {
    dependencies = [value];
  }
  const valueRef = reactExports.useRef(value);
  useIsomorphicLayoutEffect(() => {
    if (valueRef.current !== value) {
      valueRef.current = value;
    }
  }, dependencies);
  return valueRef;
}
function useLazyMemo(callback, dependencies) {
  const valueRef = reactExports.useRef();
  return reactExports.useMemo(
    () => {
      const newValue = callback(valueRef.current);
      valueRef.current = newValue;
      return newValue;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...dependencies]
  );
}
function useNodeRef(onChange) {
  const onChangeHandler = useEvent(onChange);
  const node = reactExports.useRef(null);
  const setNodeRef = reactExports.useCallback(
    (element) => {
      if (element !== node.current) {
        onChangeHandler == null ? void 0 : onChangeHandler(element, node.current);
      }
      node.current = element;
    },
    //eslint-disable-next-line
    []
  );
  return [node, setNodeRef];
}
function usePrevious(value) {
  const ref = reactExports.useRef();
  reactExports.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
let ids = {};
function useUniqueId(prefix, value) {
  return reactExports.useMemo(() => {
    if (value) {
      return value;
    }
    const id = ids[prefix] == null ? 0 : ids[prefix] + 1;
    ids[prefix] = id;
    return prefix + "-" + id;
  }, [prefix, value]);
}
function createAdjustmentFn(modifier) {
  return function(object) {
    for (var _len = arguments.length, adjustments = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      adjustments[_key - 1] = arguments[_key];
    }
    return adjustments.reduce((accumulator, adjustment) => {
      const entries = Object.entries(adjustment);
      for (const [key, valueAdjustment] of entries) {
        const value = accumulator[key];
        if (value != null) {
          accumulator[key] = value + modifier * valueAdjustment;
        }
      }
      return accumulator;
    }, {
      ...object
    });
  };
}
const add = /* @__PURE__ */ createAdjustmentFn(1);
const subtract = /* @__PURE__ */ createAdjustmentFn(-1);
function hasViewportRelativeCoordinates(event) {
  return "clientX" in event && "clientY" in event;
}
function isKeyboardEvent(event) {
  if (!event) {
    return false;
  }
  const {
    KeyboardEvent
  } = getWindow(event.target);
  return KeyboardEvent && event instanceof KeyboardEvent;
}
function isTouchEvent(event) {
  if (!event) {
    return false;
  }
  const {
    TouchEvent
  } = getWindow(event.target);
  return TouchEvent && event instanceof TouchEvent;
}
function getEventCoordinates(event) {
  if (isTouchEvent(event)) {
    if (event.touches && event.touches.length) {
      const {
        clientX: x,
        clientY: y
      } = event.touches[0];
      return {
        x,
        y
      };
    } else if (event.changedTouches && event.changedTouches.length) {
      const {
        clientX: x,
        clientY: y
      } = event.changedTouches[0];
      return {
        x,
        y
      };
    }
  }
  if (hasViewportRelativeCoordinates(event)) {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }
  return null;
}
const CSS = /* @__PURE__ */ Object.freeze({
  Translate: {
    toString(transform) {
      if (!transform) {
        return;
      }
      const {
        x,
        y
      } = transform;
      return "translate3d(" + (x ? Math.round(x) : 0) + "px, " + (y ? Math.round(y) : 0) + "px, 0)";
    }
  },
  Scale: {
    toString(transform) {
      if (!transform) {
        return;
      }
      const {
        scaleX,
        scaleY
      } = transform;
      return "scaleX(" + scaleX + ") scaleY(" + scaleY + ")";
    }
  },
  Transform: {
    toString(transform) {
      if (!transform) {
        return;
      }
      return [CSS.Translate.toString(transform), CSS.Scale.toString(transform)].join(" ");
    }
  },
  Transition: {
    toString(_ref) {
      let {
        property,
        duration,
        easing
      } = _ref;
      return property + " " + duration + "ms " + easing;
    }
  }
});
const SELECTOR = "a,frame,iframe,input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),*[tabindex]";
function findFirstFocusableNode(element) {
  if (element.matches(SELECTOR)) {
    return element;
  }
  return element.querySelector(SELECTOR);
}
const hiddenStyles = {
  display: "none"
};
function HiddenText(_ref) {
  let {
    id,
    value
  } = _ref;
  return React.createElement("div", {
    id,
    style: hiddenStyles
  }, value);
}
function LiveRegion(_ref) {
  let {
    id,
    announcement,
    ariaLiveType = "assertive"
  } = _ref;
  const visuallyHidden = {
    position: "fixed",
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    margin: -1,
    border: 0,
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(100%)",
    whiteSpace: "nowrap"
  };
  return React.createElement("div", {
    id,
    style: visuallyHidden,
    role: "status",
    "aria-live": ariaLiveType,
    "aria-atomic": true
  }, announcement);
}
function useAnnouncement() {
  const [announcement, setAnnouncement] = reactExports.useState("");
  const announce = reactExports.useCallback((value) => {
    if (value != null) {
      setAnnouncement(value);
    }
  }, []);
  return {
    announce,
    announcement
  };
}
const DndMonitorContext = /* @__PURE__ */ reactExports.createContext(null);
function useDndMonitor(listener) {
  const registerListener = reactExports.useContext(DndMonitorContext);
  reactExports.useEffect(() => {
    if (!registerListener) {
      throw new Error("useDndMonitor must be used within a children of <DndContext>");
    }
    const unsubscribe = registerListener(listener);
    return unsubscribe;
  }, [listener, registerListener]);
}
function useDndMonitorProvider() {
  const [listeners] = reactExports.useState(() => /* @__PURE__ */ new Set());
  const registerListener = reactExports.useCallback((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, [listeners]);
  const dispatch = reactExports.useCallback((_ref) => {
    let {
      type,
      event
    } = _ref;
    listeners.forEach((listener) => {
      var _listener$type;
      return (_listener$type = listener[type]) == null ? void 0 : _listener$type.call(listener, event);
    });
  }, [listeners]);
  return [dispatch, registerListener];
}
const defaultScreenReaderInstructions = {
  draggable: "\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  "
};
const defaultAnnouncements = {
  onDragStart(_ref) {
    let {
      active
    } = _ref;
    return "Picked up draggable item " + active.id + ".";
  },
  onDragOver(_ref2) {
    let {
      active,
      over
    } = _ref2;
    if (over) {
      return "Draggable item " + active.id + " was moved over droppable area " + over.id + ".";
    }
    return "Draggable item " + active.id + " is no longer over a droppable area.";
  },
  onDragEnd(_ref3) {
    let {
      active,
      over
    } = _ref3;
    if (over) {
      return "Draggable item " + active.id + " was dropped over droppable area " + over.id;
    }
    return "Draggable item " + active.id + " was dropped.";
  },
  onDragCancel(_ref4) {
    let {
      active
    } = _ref4;
    return "Dragging was cancelled. Draggable item " + active.id + " was dropped.";
  }
};
function Accessibility(_ref) {
  let {
    announcements = defaultAnnouncements,
    container,
    hiddenTextDescribedById,
    screenReaderInstructions = defaultScreenReaderInstructions
  } = _ref;
  const {
    announce,
    announcement
  } = useAnnouncement();
  const liveRegionId = useUniqueId("DndLiveRegion");
  const [mounted, setMounted] = reactExports.useState(false);
  reactExports.useEffect(() => {
    setMounted(true);
  }, []);
  useDndMonitor(reactExports.useMemo(() => ({
    onDragStart(_ref2) {
      let {
        active
      } = _ref2;
      announce(announcements.onDragStart({
        active
      }));
    },
    onDragMove(_ref3) {
      let {
        active,
        over
      } = _ref3;
      if (announcements.onDragMove) {
        announce(announcements.onDragMove({
          active,
          over
        }));
      }
    },
    onDragOver(_ref4) {
      let {
        active,
        over
      } = _ref4;
      announce(announcements.onDragOver({
        active,
        over
      }));
    },
    onDragEnd(_ref5) {
      let {
        active,
        over
      } = _ref5;
      announce(announcements.onDragEnd({
        active,
        over
      }));
    },
    onDragCancel(_ref6) {
      let {
        active,
        over
      } = _ref6;
      announce(announcements.onDragCancel({
        active,
        over
      }));
    }
  }), [announce, announcements]));
  if (!mounted) {
    return null;
  }
  const markup = React.createElement(React.Fragment, null, React.createElement(HiddenText, {
    id: hiddenTextDescribedById,
    value: screenReaderInstructions.draggable
  }), React.createElement(LiveRegion, {
    id: liveRegionId,
    announcement
  }));
  return container ? reactDomExports.createPortal(markup, container) : markup;
}
var Action;
(function(Action2) {
  Action2["DragStart"] = "dragStart";
  Action2["DragMove"] = "dragMove";
  Action2["DragEnd"] = "dragEnd";
  Action2["DragCancel"] = "dragCancel";
  Action2["DragOver"] = "dragOver";
  Action2["RegisterDroppable"] = "registerDroppable";
  Action2["SetDroppableDisabled"] = "setDroppableDisabled";
  Action2["UnregisterDroppable"] = "unregisterDroppable";
})(Action || (Action = {}));
function noop() {
}
function useSensor(sensor, options) {
  return reactExports.useMemo(
    () => ({
      sensor,
      options: options != null ? options : {}
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sensor, options]
  );
}
function useSensors() {
  for (var _len = arguments.length, sensors = new Array(_len), _key = 0; _key < _len; _key++) {
    sensors[_key] = arguments[_key];
  }
  return reactExports.useMemo(
    () => [...sensors].filter((sensor) => sensor != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...sensors]
  );
}
const defaultCoordinates = /* @__PURE__ */ Object.freeze({
  x: 0,
  y: 0
});
function distanceBetween(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
function sortCollisionsAsc(_ref, _ref2) {
  let {
    data: {
      value: a
    }
  } = _ref;
  let {
    data: {
      value: b
    }
  } = _ref2;
  return a - b;
}
function sortCollisionsDesc(_ref3, _ref4) {
  let {
    data: {
      value: a
    }
  } = _ref3;
  let {
    data: {
      value: b
    }
  } = _ref4;
  return b - a;
}
function cornersOfRectangle(_ref5) {
  let {
    left,
    top,
    height,
    width
  } = _ref5;
  return [{
    x: left,
    y: top
  }, {
    x: left + width,
    y: top
  }, {
    x: left,
    y: top + height
  }, {
    x: left + width,
    y: top + height
  }];
}
function getFirstCollision(collisions, property) {
  if (!collisions || collisions.length === 0) {
    return null;
  }
  const [firstCollision] = collisions;
  return firstCollision[property];
}
function centerOfRectangle(rect, left, top) {
  if (left === void 0) {
    left = rect.left;
  }
  if (top === void 0) {
    top = rect.top;
  }
  return {
    x: left + rect.width * 0.5,
    y: top + rect.height * 0.5
  };
}
const closestCenter = (_ref) => {
  let {
    collisionRect,
    droppableRects,
    droppableContainers
  } = _ref;
  const centerRect = centerOfRectangle(collisionRect, collisionRect.left, collisionRect.top);
  const collisions = [];
  for (const droppableContainer of droppableContainers) {
    const {
      id
    } = droppableContainer;
    const rect = droppableRects.get(id);
    if (rect) {
      const distBetween = distanceBetween(centerOfRectangle(rect), centerRect);
      collisions.push({
        id,
        data: {
          droppableContainer,
          value: distBetween
        }
      });
    }
  }
  return collisions.sort(sortCollisionsAsc);
};
const closestCorners = (_ref) => {
  let {
    collisionRect,
    droppableRects,
    droppableContainers
  } = _ref;
  const corners = cornersOfRectangle(collisionRect);
  const collisions = [];
  for (const droppableContainer of droppableContainers) {
    const {
      id
    } = droppableContainer;
    const rect = droppableRects.get(id);
    if (rect) {
      const rectCorners = cornersOfRectangle(rect);
      const distances = corners.reduce((accumulator, corner, index) => {
        return accumulator + distanceBetween(rectCorners[index], corner);
      }, 0);
      const effectiveDistance = Number((distances / 4).toFixed(4));
      collisions.push({
        id,
        data: {
          droppableContainer,
          value: effectiveDistance
        }
      });
    }
  }
  return collisions.sort(sortCollisionsAsc);
};
function getIntersectionRatio(entry, target) {
  const top = Math.max(target.top, entry.top);
  const left = Math.max(target.left, entry.left);
  const right = Math.min(target.left + target.width, entry.left + entry.width);
  const bottom = Math.min(target.top + target.height, entry.top + entry.height);
  const width = right - left;
  const height = bottom - top;
  if (left < right && top < bottom) {
    const targetArea = target.width * target.height;
    const entryArea = entry.width * entry.height;
    const intersectionArea = width * height;
    const intersectionRatio = intersectionArea / (targetArea + entryArea - intersectionArea);
    return Number(intersectionRatio.toFixed(4));
  }
  return 0;
}
const rectIntersection = (_ref) => {
  let {
    collisionRect,
    droppableRects,
    droppableContainers
  } = _ref;
  const collisions = [];
  for (const droppableContainer of droppableContainers) {
    const {
      id
    } = droppableContainer;
    const rect = droppableRects.get(id);
    if (rect) {
      const intersectionRatio = getIntersectionRatio(rect, collisionRect);
      if (intersectionRatio > 0) {
        collisions.push({
          id,
          data: {
            droppableContainer,
            value: intersectionRatio
          }
        });
      }
    }
  }
  return collisions.sort(sortCollisionsDesc);
};
function adjustScale(transform, rect1, rect2) {
  return {
    ...transform,
    scaleX: rect1 && rect2 ? rect1.width / rect2.width : 1,
    scaleY: rect1 && rect2 ? rect1.height / rect2.height : 1
  };
}
function getRectDelta(rect1, rect2) {
  return rect1 && rect2 ? {
    x: rect1.left - rect2.left,
    y: rect1.top - rect2.top
  } : defaultCoordinates;
}
function createRectAdjustmentFn(modifier) {
  return function adjustClientRect(rect) {
    for (var _len = arguments.length, adjustments = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      adjustments[_key - 1] = arguments[_key];
    }
    return adjustments.reduce((acc, adjustment) => ({
      ...acc,
      top: acc.top + modifier * adjustment.y,
      bottom: acc.bottom + modifier * adjustment.y,
      left: acc.left + modifier * adjustment.x,
      right: acc.right + modifier * adjustment.x
    }), {
      ...rect
    });
  };
}
const getAdjustedRect = /* @__PURE__ */ createRectAdjustmentFn(1);
function parseTransform(transform) {
  if (transform.startsWith("matrix3d(")) {
    const transformArray = transform.slice(9, -1).split(/, /);
    return {
      x: +transformArray[12],
      y: +transformArray[13],
      scaleX: +transformArray[0],
      scaleY: +transformArray[5]
    };
  } else if (transform.startsWith("matrix(")) {
    const transformArray = transform.slice(7, -1).split(/, /);
    return {
      x: +transformArray[4],
      y: +transformArray[5],
      scaleX: +transformArray[0],
      scaleY: +transformArray[3]
    };
  }
  return null;
}
function inverseTransform(rect, transform, transformOrigin) {
  const parsedTransform = parseTransform(transform);
  if (!parsedTransform) {
    return rect;
  }
  const {
    scaleX,
    scaleY,
    x: translateX,
    y: translateY
  } = parsedTransform;
  const x = rect.left - translateX - (1 - scaleX) * parseFloat(transformOrigin);
  const y = rect.top - translateY - (1 - scaleY) * parseFloat(transformOrigin.slice(transformOrigin.indexOf(" ") + 1));
  const w = scaleX ? rect.width / scaleX : rect.width;
  const h = scaleY ? rect.height / scaleY : rect.height;
  return {
    width: w,
    height: h,
    top: y,
    right: x + w,
    bottom: y + h,
    left: x
  };
}
const defaultOptions = {
  ignoreTransform: false
};
function getClientRect(element, options) {
  if (options === void 0) {
    options = defaultOptions;
  }
  let rect = element.getBoundingClientRect();
  if (options.ignoreTransform) {
    const {
      transform,
      transformOrigin
    } = getWindow(element).getComputedStyle(element);
    if (transform) {
      rect = inverseTransform(rect, transform, transformOrigin);
    }
  }
  const {
    top,
    left,
    width,
    height,
    bottom,
    right
  } = rect;
  return {
    top,
    left,
    width,
    height,
    bottom,
    right
  };
}
function getTransformAgnosticClientRect(element) {
  return getClientRect(element, {
    ignoreTransform: true
  });
}
function getWindowClientRect(element) {
  const width = element.innerWidth;
  const height = element.innerHeight;
  return {
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height
  };
}
function isFixed(node, computedStyle) {
  if (computedStyle === void 0) {
    computedStyle = getWindow(node).getComputedStyle(node);
  }
  return computedStyle.position === "fixed";
}
function isScrollable(element, computedStyle) {
  if (computedStyle === void 0) {
    computedStyle = getWindow(element).getComputedStyle(element);
  }
  const overflowRegex = /(auto|scroll|overlay)/;
  const properties2 = ["overflow", "overflowX", "overflowY"];
  return properties2.some((property) => {
    const value = computedStyle[property];
    return typeof value === "string" ? overflowRegex.test(value) : false;
  });
}
function getScrollableAncestors(element, limit) {
  const scrollParents = [];
  function findScrollableAncestors(node) {
    if (limit != null && scrollParents.length >= limit) {
      return scrollParents;
    }
    if (!node) {
      return scrollParents;
    }
    if (isDocument(node) && node.scrollingElement != null && !scrollParents.includes(node.scrollingElement)) {
      scrollParents.push(node.scrollingElement);
      return scrollParents;
    }
    if (!isHTMLElement(node) || isSVGElement(node)) {
      return scrollParents;
    }
    if (scrollParents.includes(node)) {
      return scrollParents;
    }
    const computedStyle = getWindow(element).getComputedStyle(node);
    if (node !== element) {
      if (isScrollable(node, computedStyle)) {
        scrollParents.push(node);
      }
    }
    if (isFixed(node, computedStyle)) {
      return scrollParents;
    }
    return findScrollableAncestors(node.parentNode);
  }
  if (!element) {
    return scrollParents;
  }
  return findScrollableAncestors(element);
}
function getFirstScrollableAncestor(node) {
  const [firstScrollableAncestor] = getScrollableAncestors(node, 1);
  return firstScrollableAncestor != null ? firstScrollableAncestor : null;
}
function getScrollableElement(element) {
  if (!canUseDOM || !element) {
    return null;
  }
  if (isWindow(element)) {
    return element;
  }
  if (!isNode(element)) {
    return null;
  }
  if (isDocument(element) || element === getOwnerDocument(element).scrollingElement) {
    return window;
  }
  if (isHTMLElement(element)) {
    return element;
  }
  return null;
}
function getScrollXCoordinate(element) {
  if (isWindow(element)) {
    return element.scrollX;
  }
  return element.scrollLeft;
}
function getScrollYCoordinate(element) {
  if (isWindow(element)) {
    return element.scrollY;
  }
  return element.scrollTop;
}
function getScrollCoordinates(element) {
  return {
    x: getScrollXCoordinate(element),
    y: getScrollYCoordinate(element)
  };
}
var Direction;
(function(Direction2) {
  Direction2[Direction2["Forward"] = 1] = "Forward";
  Direction2[Direction2["Backward"] = -1] = "Backward";
})(Direction || (Direction = {}));
function isDocumentScrollingElement(element) {
  if (!canUseDOM || !element) {
    return false;
  }
  return element === document.scrollingElement;
}
function getScrollPosition(scrollingContainer) {
  const minScroll = {
    x: 0,
    y: 0
  };
  const dimensions = isDocumentScrollingElement(scrollingContainer) ? {
    height: window.innerHeight,
    width: window.innerWidth
  } : {
    height: scrollingContainer.clientHeight,
    width: scrollingContainer.clientWidth
  };
  const maxScroll = {
    x: scrollingContainer.scrollWidth - dimensions.width,
    y: scrollingContainer.scrollHeight - dimensions.height
  };
  const isTop = scrollingContainer.scrollTop <= minScroll.y;
  const isLeft = scrollingContainer.scrollLeft <= minScroll.x;
  const isBottom = scrollingContainer.scrollTop >= maxScroll.y;
  const isRight = scrollingContainer.scrollLeft >= maxScroll.x;
  return {
    isTop,
    isLeft,
    isBottom,
    isRight,
    maxScroll,
    minScroll
  };
}
const defaultThreshold = {
  x: 0.2,
  y: 0.2
};
function getScrollDirectionAndSpeed(scrollContainer, scrollContainerRect, _ref, acceleration, thresholdPercentage) {
  let {
    top,
    left,
    right,
    bottom
  } = _ref;
  if (acceleration === void 0) {
    acceleration = 10;
  }
  if (thresholdPercentage === void 0) {
    thresholdPercentage = defaultThreshold;
  }
  const {
    isTop,
    isBottom,
    isLeft,
    isRight
  } = getScrollPosition(scrollContainer);
  const direction = {
    x: 0,
    y: 0
  };
  const speed = {
    x: 0,
    y: 0
  };
  const threshold = {
    height: scrollContainerRect.height * thresholdPercentage.y,
    width: scrollContainerRect.width * thresholdPercentage.x
  };
  if (!isTop && top <= scrollContainerRect.top + threshold.height) {
    direction.y = Direction.Backward;
    speed.y = acceleration * Math.abs((scrollContainerRect.top + threshold.height - top) / threshold.height);
  } else if (!isBottom && bottom >= scrollContainerRect.bottom - threshold.height) {
    direction.y = Direction.Forward;
    speed.y = acceleration * Math.abs((scrollContainerRect.bottom - threshold.height - bottom) / threshold.height);
  }
  if (!isRight && right >= scrollContainerRect.right - threshold.width) {
    direction.x = Direction.Forward;
    speed.x = acceleration * Math.abs((scrollContainerRect.right - threshold.width - right) / threshold.width);
  } else if (!isLeft && left <= scrollContainerRect.left + threshold.width) {
    direction.x = Direction.Backward;
    speed.x = acceleration * Math.abs((scrollContainerRect.left + threshold.width - left) / threshold.width);
  }
  return {
    direction,
    speed
  };
}
function getScrollElementRect(element) {
  if (element === document.scrollingElement) {
    const {
      innerWidth,
      innerHeight
    } = window;
    return {
      top: 0,
      left: 0,
      right: innerWidth,
      bottom: innerHeight,
      width: innerWidth,
      height: innerHeight
    };
  }
  const {
    top,
    left,
    right,
    bottom
  } = element.getBoundingClientRect();
  return {
    top,
    left,
    right,
    bottom,
    width: element.clientWidth,
    height: element.clientHeight
  };
}
function getScrollOffsets(scrollableAncestors) {
  return scrollableAncestors.reduce((acc, node) => {
    return add(acc, getScrollCoordinates(node));
  }, defaultCoordinates);
}
function getScrollXOffset(scrollableAncestors) {
  return scrollableAncestors.reduce((acc, node) => {
    return acc + getScrollXCoordinate(node);
  }, 0);
}
function getScrollYOffset(scrollableAncestors) {
  return scrollableAncestors.reduce((acc, node) => {
    return acc + getScrollYCoordinate(node);
  }, 0);
}
function scrollIntoViewIfNeeded(element, measure) {
  if (measure === void 0) {
    measure = getClientRect;
  }
  if (!element) {
    return;
  }
  const {
    top,
    left,
    bottom,
    right
  } = measure(element);
  const firstScrollableAncestor = getFirstScrollableAncestor(element);
  if (!firstScrollableAncestor) {
    return;
  }
  if (bottom <= 0 || right <= 0 || top >= window.innerHeight || left >= window.innerWidth) {
    element.scrollIntoView({
      block: "center",
      inline: "center"
    });
  }
}
const properties = [["x", ["left", "right"], getScrollXOffset], ["y", ["top", "bottom"], getScrollYOffset]];
class Rect {
  constructor(rect, element) {
    this.rect = void 0;
    this.width = void 0;
    this.height = void 0;
    this.top = void 0;
    this.bottom = void 0;
    this.right = void 0;
    this.left = void 0;
    const scrollableAncestors = getScrollableAncestors(element);
    const scrollOffsets = getScrollOffsets(scrollableAncestors);
    this.rect = {
      ...rect
    };
    this.width = rect.width;
    this.height = rect.height;
    for (const [axis, keys, getScrollOffset] of properties) {
      for (const key of keys) {
        Object.defineProperty(this, key, {
          get: () => {
            const currentOffsets = getScrollOffset(scrollableAncestors);
            const scrollOffsetsDeltla = scrollOffsets[axis] - currentOffsets;
            return this.rect[key] + scrollOffsetsDeltla;
          },
          enumerable: true
        });
      }
    }
    Object.defineProperty(this, "rect", {
      enumerable: false
    });
  }
}
class Listeners {
  constructor(target) {
    this.target = void 0;
    this.listeners = [];
    this.removeAll = () => {
      this.listeners.forEach((listener) => {
        var _this$target;
        return (_this$target = this.target) == null ? void 0 : _this$target.removeEventListener(...listener);
      });
    };
    this.target = target;
  }
  add(eventName, handler, options) {
    var _this$target2;
    (_this$target2 = this.target) == null ? void 0 : _this$target2.addEventListener(eventName, handler, options);
    this.listeners.push([eventName, handler, options]);
  }
}
function getEventListenerTarget(target) {
  const {
    EventTarget
  } = getWindow(target);
  return target instanceof EventTarget ? target : getOwnerDocument(target);
}
function hasExceededDistance(delta, measurement) {
  const dx = Math.abs(delta.x);
  const dy = Math.abs(delta.y);
  if (typeof measurement === "number") {
    return Math.sqrt(dx ** 2 + dy ** 2) > measurement;
  }
  if ("x" in measurement && "y" in measurement) {
    return dx > measurement.x && dy > measurement.y;
  }
  if ("x" in measurement) {
    return dx > measurement.x;
  }
  if ("y" in measurement) {
    return dy > measurement.y;
  }
  return false;
}
var EventName;
(function(EventName2) {
  EventName2["Click"] = "click";
  EventName2["DragStart"] = "dragstart";
  EventName2["Keydown"] = "keydown";
  EventName2["ContextMenu"] = "contextmenu";
  EventName2["Resize"] = "resize";
  EventName2["SelectionChange"] = "selectionchange";
  EventName2["VisibilityChange"] = "visibilitychange";
})(EventName || (EventName = {}));
function preventDefault(event) {
  event.preventDefault();
}
function stopPropagation(event) {
  event.stopPropagation();
}
var KeyboardCode;
(function(KeyboardCode2) {
  KeyboardCode2["Space"] = "Space";
  KeyboardCode2["Down"] = "ArrowDown";
  KeyboardCode2["Right"] = "ArrowRight";
  KeyboardCode2["Left"] = "ArrowLeft";
  KeyboardCode2["Up"] = "ArrowUp";
  KeyboardCode2["Esc"] = "Escape";
  KeyboardCode2["Enter"] = "Enter";
  KeyboardCode2["Tab"] = "Tab";
})(KeyboardCode || (KeyboardCode = {}));
const defaultKeyboardCodes = {
  start: [KeyboardCode.Space, KeyboardCode.Enter],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab]
};
const defaultKeyboardCoordinateGetter = (event, _ref) => {
  let {
    currentCoordinates
  } = _ref;
  switch (event.code) {
    case KeyboardCode.Right:
      return {
        ...currentCoordinates,
        x: currentCoordinates.x + 25
      };
    case KeyboardCode.Left:
      return {
        ...currentCoordinates,
        x: currentCoordinates.x - 25
      };
    case KeyboardCode.Down:
      return {
        ...currentCoordinates,
        y: currentCoordinates.y + 25
      };
    case KeyboardCode.Up:
      return {
        ...currentCoordinates,
        y: currentCoordinates.y - 25
      };
  }
  return void 0;
};
class KeyboardSensor {
  constructor(props) {
    this.props = void 0;
    this.autoScrollEnabled = false;
    this.referenceCoordinates = void 0;
    this.listeners = void 0;
    this.windowListeners = void 0;
    this.props = props;
    const {
      event: {
        target
      }
    } = props;
    this.props = props;
    this.listeners = new Listeners(getOwnerDocument(target));
    this.windowListeners = new Listeners(getWindow(target));
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.attach();
  }
  attach() {
    this.handleStart();
    this.windowListeners.add(EventName.Resize, this.handleCancel);
    this.windowListeners.add(EventName.VisibilityChange, this.handleCancel);
    setTimeout(() => this.listeners.add(EventName.Keydown, this.handleKeyDown));
  }
  handleStart() {
    const {
      activeNode,
      onStart
    } = this.props;
    const node = activeNode.node.current;
    if (node) {
      scrollIntoViewIfNeeded(node);
    }
    onStart(defaultCoordinates);
  }
  handleKeyDown(event) {
    if (isKeyboardEvent(event)) {
      const {
        active,
        context,
        options
      } = this.props;
      const {
        keyboardCodes = defaultKeyboardCodes,
        coordinateGetter = defaultKeyboardCoordinateGetter,
        scrollBehavior = "smooth"
      } = options;
      const {
        code
      } = event;
      if (keyboardCodes.end.includes(code)) {
        this.handleEnd(event);
        return;
      }
      if (keyboardCodes.cancel.includes(code)) {
        this.handleCancel(event);
        return;
      }
      const {
        collisionRect
      } = context.current;
      const currentCoordinates = collisionRect ? {
        x: collisionRect.left,
        y: collisionRect.top
      } : defaultCoordinates;
      if (!this.referenceCoordinates) {
        this.referenceCoordinates = currentCoordinates;
      }
      const newCoordinates = coordinateGetter(event, {
        active,
        context: context.current,
        currentCoordinates
      });
      if (newCoordinates) {
        const coordinatesDelta = subtract(newCoordinates, currentCoordinates);
        const scrollDelta = {
          x: 0,
          y: 0
        };
        const {
          scrollableAncestors
        } = context.current;
        for (const scrollContainer of scrollableAncestors) {
          const direction = event.code;
          const {
            isTop,
            isRight,
            isLeft,
            isBottom,
            maxScroll,
            minScroll
          } = getScrollPosition(scrollContainer);
          const scrollElementRect = getScrollElementRect(scrollContainer);
          const clampedCoordinates = {
            x: Math.min(direction === KeyboardCode.Right ? scrollElementRect.right - scrollElementRect.width / 2 : scrollElementRect.right, Math.max(direction === KeyboardCode.Right ? scrollElementRect.left : scrollElementRect.left + scrollElementRect.width / 2, newCoordinates.x)),
            y: Math.min(direction === KeyboardCode.Down ? scrollElementRect.bottom - scrollElementRect.height / 2 : scrollElementRect.bottom, Math.max(direction === KeyboardCode.Down ? scrollElementRect.top : scrollElementRect.top + scrollElementRect.height / 2, newCoordinates.y))
          };
          const canScrollX = direction === KeyboardCode.Right && !isRight || direction === KeyboardCode.Left && !isLeft;
          const canScrollY = direction === KeyboardCode.Down && !isBottom || direction === KeyboardCode.Up && !isTop;
          if (canScrollX && clampedCoordinates.x !== newCoordinates.x) {
            const newScrollCoordinates = scrollContainer.scrollLeft + coordinatesDelta.x;
            const canScrollToNewCoordinates = direction === KeyboardCode.Right && newScrollCoordinates <= maxScroll.x || direction === KeyboardCode.Left && newScrollCoordinates >= minScroll.x;
            if (canScrollToNewCoordinates && !coordinatesDelta.y) {
              scrollContainer.scrollTo({
                left: newScrollCoordinates,
                behavior: scrollBehavior
              });
              return;
            }
            if (canScrollToNewCoordinates) {
              scrollDelta.x = scrollContainer.scrollLeft - newScrollCoordinates;
            } else {
              scrollDelta.x = direction === KeyboardCode.Right ? scrollContainer.scrollLeft - maxScroll.x : scrollContainer.scrollLeft - minScroll.x;
            }
            if (scrollDelta.x) {
              scrollContainer.scrollBy({
                left: -scrollDelta.x,
                behavior: scrollBehavior
              });
            }
            break;
          } else if (canScrollY && clampedCoordinates.y !== newCoordinates.y) {
            const newScrollCoordinates = scrollContainer.scrollTop + coordinatesDelta.y;
            const canScrollToNewCoordinates = direction === KeyboardCode.Down && newScrollCoordinates <= maxScroll.y || direction === KeyboardCode.Up && newScrollCoordinates >= minScroll.y;
            if (canScrollToNewCoordinates && !coordinatesDelta.x) {
              scrollContainer.scrollTo({
                top: newScrollCoordinates,
                behavior: scrollBehavior
              });
              return;
            }
            if (canScrollToNewCoordinates) {
              scrollDelta.y = scrollContainer.scrollTop - newScrollCoordinates;
            } else {
              scrollDelta.y = direction === KeyboardCode.Down ? scrollContainer.scrollTop - maxScroll.y : scrollContainer.scrollTop - minScroll.y;
            }
            if (scrollDelta.y) {
              scrollContainer.scrollBy({
                top: -scrollDelta.y,
                behavior: scrollBehavior
              });
            }
            break;
          }
        }
        this.handleMove(event, add(subtract(newCoordinates, this.referenceCoordinates), scrollDelta));
      }
    }
  }
  handleMove(event, coordinates) {
    const {
      onMove
    } = this.props;
    event.preventDefault();
    onMove(coordinates);
  }
  handleEnd(event) {
    const {
      onEnd
    } = this.props;
    event.preventDefault();
    this.detach();
    onEnd();
  }
  handleCancel(event) {
    const {
      onCancel
    } = this.props;
    event.preventDefault();
    this.detach();
    onCancel();
  }
  detach() {
    this.listeners.removeAll();
    this.windowListeners.removeAll();
  }
}
KeyboardSensor.activators = [{
  eventName: "onKeyDown",
  handler: (event, _ref, _ref2) => {
    let {
      keyboardCodes = defaultKeyboardCodes,
      onActivation
    } = _ref;
    let {
      active
    } = _ref2;
    const {
      code
    } = event.nativeEvent;
    if (keyboardCodes.start.includes(code)) {
      const activator = active.activatorNode.current;
      if (activator && event.target !== activator) {
        return false;
      }
      event.preventDefault();
      onActivation == null ? void 0 : onActivation({
        event: event.nativeEvent
      });
      return true;
    }
    return false;
  }
}];
function isDistanceConstraint(constraint) {
  return Boolean(constraint && "distance" in constraint);
}
function isDelayConstraint(constraint) {
  return Boolean(constraint && "delay" in constraint);
}
class AbstractPointerSensor {
  constructor(props, events2, listenerTarget) {
    var _getEventCoordinates;
    if (listenerTarget === void 0) {
      listenerTarget = getEventListenerTarget(props.event.target);
    }
    this.props = void 0;
    this.events = void 0;
    this.autoScrollEnabled = true;
    this.document = void 0;
    this.activated = false;
    this.initialCoordinates = void 0;
    this.timeoutId = null;
    this.listeners = void 0;
    this.documentListeners = void 0;
    this.windowListeners = void 0;
    this.props = props;
    this.events = events2;
    const {
      event
    } = props;
    const {
      target
    } = event;
    this.props = props;
    this.events = events2;
    this.document = getOwnerDocument(target);
    this.documentListeners = new Listeners(this.document);
    this.listeners = new Listeners(listenerTarget);
    this.windowListeners = new Listeners(getWindow(target));
    this.initialCoordinates = (_getEventCoordinates = getEventCoordinates(event)) != null ? _getEventCoordinates : defaultCoordinates;
    this.handleStart = this.handleStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleEnd = this.handleEnd.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.removeTextSelection = this.removeTextSelection.bind(this);
    this.attach();
  }
  attach() {
    const {
      events: events2,
      props: {
        options: {
          activationConstraint,
          bypassActivationConstraint
        }
      }
    } = this;
    this.listeners.add(events2.move.name, this.handleMove, {
      passive: false
    });
    this.listeners.add(events2.end.name, this.handleEnd);
    if (events2.cancel) {
      this.listeners.add(events2.cancel.name, this.handleCancel);
    }
    this.windowListeners.add(EventName.Resize, this.handleCancel);
    this.windowListeners.add(EventName.DragStart, preventDefault);
    this.windowListeners.add(EventName.VisibilityChange, this.handleCancel);
    this.windowListeners.add(EventName.ContextMenu, preventDefault);
    this.documentListeners.add(EventName.Keydown, this.handleKeydown);
    if (activationConstraint) {
      if (bypassActivationConstraint != null && bypassActivationConstraint({
        event: this.props.event,
        activeNode: this.props.activeNode,
        options: this.props.options
      })) {
        return this.handleStart();
      }
      if (isDelayConstraint(activationConstraint)) {
        this.timeoutId = setTimeout(this.handleStart, activationConstraint.delay);
        this.handlePending(activationConstraint);
        return;
      }
      if (isDistanceConstraint(activationConstraint)) {
        this.handlePending(activationConstraint);
        return;
      }
    }
    this.handleStart();
  }
  detach() {
    this.listeners.removeAll();
    this.windowListeners.removeAll();
    setTimeout(this.documentListeners.removeAll, 50);
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
  handlePending(constraint, offset) {
    const {
      active,
      onPending
    } = this.props;
    onPending(active, constraint, this.initialCoordinates, offset);
  }
  handleStart() {
    const {
      initialCoordinates
    } = this;
    const {
      onStart
    } = this.props;
    if (initialCoordinates) {
      this.activated = true;
      this.documentListeners.add(EventName.Click, stopPropagation, {
        capture: true
      });
      this.removeTextSelection();
      this.documentListeners.add(EventName.SelectionChange, this.removeTextSelection);
      onStart(initialCoordinates);
    }
  }
  handleMove(event) {
    var _getEventCoordinates2;
    const {
      activated,
      initialCoordinates,
      props
    } = this;
    const {
      onMove,
      options: {
        activationConstraint
      }
    } = props;
    if (!initialCoordinates) {
      return;
    }
    const coordinates = (_getEventCoordinates2 = getEventCoordinates(event)) != null ? _getEventCoordinates2 : defaultCoordinates;
    const delta = subtract(initialCoordinates, coordinates);
    if (!activated && activationConstraint) {
      if (isDistanceConstraint(activationConstraint)) {
        if (activationConstraint.tolerance != null && hasExceededDistance(delta, activationConstraint.tolerance)) {
          return this.handleCancel();
        }
        if (hasExceededDistance(delta, activationConstraint.distance)) {
          return this.handleStart();
        }
      }
      if (isDelayConstraint(activationConstraint)) {
        if (hasExceededDistance(delta, activationConstraint.tolerance)) {
          return this.handleCancel();
        }
      }
      this.handlePending(activationConstraint, delta);
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    onMove(coordinates);
  }
  handleEnd() {
    const {
      onAbort,
      onEnd
    } = this.props;
    this.detach();
    if (!this.activated) {
      onAbort(this.props.active);
    }
    onEnd();
  }
  handleCancel() {
    const {
      onAbort,
      onCancel
    } = this.props;
    this.detach();
    if (!this.activated) {
      onAbort(this.props.active);
    }
    onCancel();
  }
  handleKeydown(event) {
    if (event.code === KeyboardCode.Esc) {
      this.handleCancel();
    }
  }
  removeTextSelection() {
    var _this$document$getSel;
    (_this$document$getSel = this.document.getSelection()) == null ? void 0 : _this$document$getSel.removeAllRanges();
  }
}
const events = {
  cancel: {
    name: "pointercancel"
  },
  move: {
    name: "pointermove"
  },
  end: {
    name: "pointerup"
  }
};
class PointerSensor extends AbstractPointerSensor {
  constructor(props) {
    const {
      event
    } = props;
    const listenerTarget = getOwnerDocument(event.target);
    super(props, events, listenerTarget);
  }
}
PointerSensor.activators = [{
  eventName: "onPointerDown",
  handler: (_ref, _ref2) => {
    let {
      nativeEvent: event
    } = _ref;
    let {
      onActivation
    } = _ref2;
    if (!event.isPrimary || event.button !== 0) {
      return false;
    }
    onActivation == null ? void 0 : onActivation({
      event
    });
    return true;
  }
}];
const events$1 = {
  move: {
    name: "mousemove"
  },
  end: {
    name: "mouseup"
  }
};
var MouseButton;
(function(MouseButton2) {
  MouseButton2[MouseButton2["RightClick"] = 2] = "RightClick";
})(MouseButton || (MouseButton = {}));
class MouseSensor extends AbstractPointerSensor {
  constructor(props) {
    super(props, events$1, getOwnerDocument(props.event.target));
  }
}
MouseSensor.activators = [{
  eventName: "onMouseDown",
  handler: (_ref, _ref2) => {
    let {
      nativeEvent: event
    } = _ref;
    let {
      onActivation
    } = _ref2;
    if (event.button === MouseButton.RightClick) {
      return false;
    }
    onActivation == null ? void 0 : onActivation({
      event
    });
    return true;
  }
}];
const events$2 = {
  cancel: {
    name: "touchcancel"
  },
  move: {
    name: "touchmove"
  },
  end: {
    name: "touchend"
  }
};
class TouchSensor extends AbstractPointerSensor {
  constructor(props) {
    super(props, events$2);
  }
  static setup() {
    window.addEventListener(events$2.move.name, noop2, {
      capture: false,
      passive: false
    });
    return function teardown() {
      window.removeEventListener(events$2.move.name, noop2);
    };
    function noop2() {
    }
  }
}
TouchSensor.activators = [{
  eventName: "onTouchStart",
  handler: (_ref, _ref2) => {
    let {
      nativeEvent: event
    } = _ref;
    let {
      onActivation
    } = _ref2;
    const {
      touches
    } = event;
    if (touches.length > 1) {
      return false;
    }
    onActivation == null ? void 0 : onActivation({
      event
    });
    return true;
  }
}];
var AutoScrollActivator;
(function(AutoScrollActivator2) {
  AutoScrollActivator2[AutoScrollActivator2["Pointer"] = 0] = "Pointer";
  AutoScrollActivator2[AutoScrollActivator2["DraggableRect"] = 1] = "DraggableRect";
})(AutoScrollActivator || (AutoScrollActivator = {}));
var TraversalOrder;
(function(TraversalOrder2) {
  TraversalOrder2[TraversalOrder2["TreeOrder"] = 0] = "TreeOrder";
  TraversalOrder2[TraversalOrder2["ReversedTreeOrder"] = 1] = "ReversedTreeOrder";
})(TraversalOrder || (TraversalOrder = {}));
function useAutoScroller(_ref) {
  let {
    acceleration,
    activator = AutoScrollActivator.Pointer,
    canScroll,
    draggingRect,
    enabled,
    interval = 5,
    order = TraversalOrder.TreeOrder,
    pointerCoordinates,
    scrollableAncestors,
    scrollableAncestorRects,
    delta,
    threshold
  } = _ref;
  const scrollIntent = useScrollIntent({
    delta,
    disabled: !enabled
  });
  const [setAutoScrollInterval, clearAutoScrollInterval] = useInterval();
  const scrollSpeed = reactExports.useRef({
    x: 0,
    y: 0
  });
  const scrollDirection = reactExports.useRef({
    x: 0,
    y: 0
  });
  const rect = reactExports.useMemo(() => {
    switch (activator) {
      case AutoScrollActivator.Pointer:
        return pointerCoordinates ? {
          top: pointerCoordinates.y,
          bottom: pointerCoordinates.y,
          left: pointerCoordinates.x,
          right: pointerCoordinates.x
        } : null;
      case AutoScrollActivator.DraggableRect:
        return draggingRect;
    }
  }, [activator, draggingRect, pointerCoordinates]);
  const scrollContainerRef = reactExports.useRef(null);
  const autoScroll = reactExports.useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }
    const scrollLeft = scrollSpeed.current.x * scrollDirection.current.x;
    const scrollTop = scrollSpeed.current.y * scrollDirection.current.y;
    scrollContainer.scrollBy(scrollLeft, scrollTop);
  }, []);
  const sortedScrollableAncestors = reactExports.useMemo(() => order === TraversalOrder.TreeOrder ? [...scrollableAncestors].reverse() : scrollableAncestors, [order, scrollableAncestors]);
  reactExports.useEffect(
    () => {
      if (!enabled || !scrollableAncestors.length || !rect) {
        clearAutoScrollInterval();
        return;
      }
      for (const scrollContainer of sortedScrollableAncestors) {
        if ((canScroll == null ? void 0 : canScroll(scrollContainer)) === false) {
          continue;
        }
        const index = scrollableAncestors.indexOf(scrollContainer);
        const scrollContainerRect = scrollableAncestorRects[index];
        if (!scrollContainerRect) {
          continue;
        }
        const {
          direction,
          speed
        } = getScrollDirectionAndSpeed(scrollContainer, scrollContainerRect, rect, acceleration, threshold);
        for (const axis of ["x", "y"]) {
          if (!scrollIntent[axis][direction[axis]]) {
            speed[axis] = 0;
            direction[axis] = 0;
          }
        }
        if (speed.x > 0 || speed.y > 0) {
          clearAutoScrollInterval();
          scrollContainerRef.current = scrollContainer;
          setAutoScrollInterval(autoScroll, interval);
          scrollSpeed.current = speed;
          scrollDirection.current = direction;
          return;
        }
      }
      scrollSpeed.current = {
        x: 0,
        y: 0
      };
      scrollDirection.current = {
        x: 0,
        y: 0
      };
      clearAutoScrollInterval();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      acceleration,
      autoScroll,
      canScroll,
      clearAutoScrollInterval,
      enabled,
      interval,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(rect),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(scrollIntent),
      setAutoScrollInterval,
      scrollableAncestors,
      sortedScrollableAncestors,
      scrollableAncestorRects,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(threshold)
    ]
  );
}
const defaultScrollIntent = {
  x: {
    [Direction.Backward]: false,
    [Direction.Forward]: false
  },
  y: {
    [Direction.Backward]: false,
    [Direction.Forward]: false
  }
};
function useScrollIntent(_ref2) {
  let {
    delta,
    disabled
  } = _ref2;
  const previousDelta = usePrevious(delta);
  return useLazyMemo((previousIntent) => {
    if (disabled || !previousDelta || !previousIntent) {
      return defaultScrollIntent;
    }
    const direction = {
      x: Math.sign(delta.x - previousDelta.x),
      y: Math.sign(delta.y - previousDelta.y)
    };
    return {
      x: {
        [Direction.Backward]: previousIntent.x[Direction.Backward] || direction.x === -1,
        [Direction.Forward]: previousIntent.x[Direction.Forward] || direction.x === 1
      },
      y: {
        [Direction.Backward]: previousIntent.y[Direction.Backward] || direction.y === -1,
        [Direction.Forward]: previousIntent.y[Direction.Forward] || direction.y === 1
      }
    };
  }, [disabled, delta, previousDelta]);
}
function useCachedNode(draggableNodes, id) {
  const draggableNode = id != null ? draggableNodes.get(id) : void 0;
  const node = draggableNode ? draggableNode.node.current : null;
  return useLazyMemo((cachedNode) => {
    var _ref;
    if (id == null) {
      return null;
    }
    return (_ref = node != null ? node : cachedNode) != null ? _ref : null;
  }, [node, id]);
}
function useCombineActivators(sensors, getSyntheticHandler) {
  return reactExports.useMemo(() => sensors.reduce((accumulator, sensor) => {
    const {
      sensor: Sensor
    } = sensor;
    const sensorActivators = Sensor.activators.map((activator) => ({
      eventName: activator.eventName,
      handler: getSyntheticHandler(activator.handler, sensor)
    }));
    return [...accumulator, ...sensorActivators];
  }, []), [sensors, getSyntheticHandler]);
}
var MeasuringStrategy;
(function(MeasuringStrategy2) {
  MeasuringStrategy2[MeasuringStrategy2["Always"] = 0] = "Always";
  MeasuringStrategy2[MeasuringStrategy2["BeforeDragging"] = 1] = "BeforeDragging";
  MeasuringStrategy2[MeasuringStrategy2["WhileDragging"] = 2] = "WhileDragging";
})(MeasuringStrategy || (MeasuringStrategy = {}));
var MeasuringFrequency;
(function(MeasuringFrequency2) {
  MeasuringFrequency2["Optimized"] = "optimized";
})(MeasuringFrequency || (MeasuringFrequency = {}));
const defaultValue = /* @__PURE__ */ new Map();
function useDroppableMeasuring(containers, _ref) {
  let {
    dragging,
    dependencies,
    config
  } = _ref;
  const [queue, setQueue] = reactExports.useState(null);
  const {
    frequency,
    measure,
    strategy
  } = config;
  const containersRef = reactExports.useRef(containers);
  const disabled = isDisabled();
  const disabledRef = useLatestValue(disabled);
  const measureDroppableContainers = reactExports.useCallback(function(ids2) {
    if (ids2 === void 0) {
      ids2 = [];
    }
    if (disabledRef.current) {
      return;
    }
    setQueue((value) => {
      if (value === null) {
        return ids2;
      }
      return value.concat(ids2.filter((id) => !value.includes(id)));
    });
  }, [disabledRef]);
  const timeoutId = reactExports.useRef(null);
  const droppableRects = useLazyMemo((previousValue) => {
    if (disabled && !dragging) {
      return defaultValue;
    }
    if (!previousValue || previousValue === defaultValue || containersRef.current !== containers || queue != null) {
      const map = /* @__PURE__ */ new Map();
      for (let container of containers) {
        if (!container) {
          continue;
        }
        if (queue && queue.length > 0 && !queue.includes(container.id) && container.rect.current) {
          map.set(container.id, container.rect.current);
          continue;
        }
        const node = container.node.current;
        const rect = node ? new Rect(measure(node), node) : null;
        container.rect.current = rect;
        if (rect) {
          map.set(container.id, rect);
        }
      }
      return map;
    }
    return previousValue;
  }, [containers, queue, dragging, disabled, measure]);
  reactExports.useEffect(() => {
    containersRef.current = containers;
  }, [containers]);
  reactExports.useEffect(
    () => {
      if (disabled) {
        return;
      }
      measureDroppableContainers();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragging, disabled]
  );
  reactExports.useEffect(
    () => {
      if (queue && queue.length > 0) {
        setQueue(null);
      }
    },
    //eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queue)]
  );
  reactExports.useEffect(
    () => {
      if (disabled || typeof frequency !== "number" || timeoutId.current !== null) {
        return;
      }
      timeoutId.current = setTimeout(() => {
        measureDroppableContainers();
        timeoutId.current = null;
      }, frequency);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frequency, disabled, measureDroppableContainers, ...dependencies]
  );
  return {
    droppableRects,
    measureDroppableContainers,
    measuringScheduled: queue != null
  };
  function isDisabled() {
    switch (strategy) {
      case MeasuringStrategy.Always:
        return false;
      case MeasuringStrategy.BeforeDragging:
        return dragging;
      default:
        return !dragging;
    }
  }
}
function useInitialValue(value, computeFn) {
  return useLazyMemo((previousValue) => {
    if (!value) {
      return null;
    }
    if (previousValue) {
      return previousValue;
    }
    return typeof computeFn === "function" ? computeFn(value) : value;
  }, [computeFn, value]);
}
function useInitialRect(node, measure) {
  return useInitialValue(node, measure);
}
function useMutationObserver(_ref) {
  let {
    callback,
    disabled
  } = _ref;
  const handleMutations = useEvent(callback);
  const mutationObserver = reactExports.useMemo(() => {
    if (disabled || typeof window === "undefined" || typeof window.MutationObserver === "undefined") {
      return void 0;
    }
    const {
      MutationObserver
    } = window;
    return new MutationObserver(handleMutations);
  }, [handleMutations, disabled]);
  reactExports.useEffect(() => {
    return () => mutationObserver == null ? void 0 : mutationObserver.disconnect();
  }, [mutationObserver]);
  return mutationObserver;
}
function useResizeObserver(_ref) {
  let {
    callback,
    disabled
  } = _ref;
  const handleResize = useEvent(callback);
  const resizeObserver = reactExports.useMemo(
    () => {
      if (disabled || typeof window === "undefined" || typeof window.ResizeObserver === "undefined") {
        return void 0;
      }
      const {
        ResizeObserver: ResizeObserver2
      } = window;
      return new ResizeObserver2(handleResize);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled]
  );
  reactExports.useEffect(() => {
    return () => resizeObserver == null ? void 0 : resizeObserver.disconnect();
  }, [resizeObserver]);
  return resizeObserver;
}
function defaultMeasure(element) {
  return new Rect(getClientRect(element), element);
}
function useRect(element, measure, fallbackRect) {
  if (measure === void 0) {
    measure = defaultMeasure;
  }
  const [rect, setRect] = reactExports.useState(null);
  function measureRect() {
    setRect((currentRect) => {
      if (!element) {
        return null;
      }
      if (element.isConnected === false) {
        var _ref;
        return (_ref = currentRect != null ? currentRect : fallbackRect) != null ? _ref : null;
      }
      const newRect = measure(element);
      if (JSON.stringify(currentRect) === JSON.stringify(newRect)) {
        return currentRect;
      }
      return newRect;
    });
  }
  const mutationObserver = useMutationObserver({
    callback(records) {
      if (!element) {
        return;
      }
      for (const record of records) {
        const {
          type,
          target
        } = record;
        if (type === "childList" && target instanceof HTMLElement && target.contains(element)) {
          measureRect();
          break;
        }
      }
    }
  });
  const resizeObserver = useResizeObserver({
    callback: measureRect
  });
  useIsomorphicLayoutEffect(() => {
    measureRect();
    if (element) {
      resizeObserver == null ? void 0 : resizeObserver.observe(element);
      mutationObserver == null ? void 0 : mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      resizeObserver == null ? void 0 : resizeObserver.disconnect();
      mutationObserver == null ? void 0 : mutationObserver.disconnect();
    }
  }, [element]);
  return rect;
}
function useRectDelta(rect) {
  const initialRect = useInitialValue(rect);
  return getRectDelta(rect, initialRect);
}
const defaultValue$1 = [];
function useScrollableAncestors(node) {
  const previousNode = reactExports.useRef(node);
  const ancestors = useLazyMemo((previousValue) => {
    if (!node) {
      return defaultValue$1;
    }
    if (previousValue && previousValue !== defaultValue$1 && node && previousNode.current && node.parentNode === previousNode.current.parentNode) {
      return previousValue;
    }
    return getScrollableAncestors(node);
  }, [node]);
  reactExports.useEffect(() => {
    previousNode.current = node;
  }, [node]);
  return ancestors;
}
function useScrollOffsets(elements) {
  const [scrollCoordinates, setScrollCoordinates] = reactExports.useState(null);
  const prevElements = reactExports.useRef(elements);
  const handleScroll = reactExports.useCallback((event) => {
    const scrollingElement = getScrollableElement(event.target);
    if (!scrollingElement) {
      return;
    }
    setScrollCoordinates((scrollCoordinates2) => {
      if (!scrollCoordinates2) {
        return null;
      }
      scrollCoordinates2.set(scrollingElement, getScrollCoordinates(scrollingElement));
      return new Map(scrollCoordinates2);
    });
  }, []);
  reactExports.useEffect(() => {
    const previousElements = prevElements.current;
    if (elements !== previousElements) {
      cleanup(previousElements);
      const entries = elements.map((element) => {
        const scrollableElement = getScrollableElement(element);
        if (scrollableElement) {
          scrollableElement.addEventListener("scroll", handleScroll, {
            passive: true
          });
          return [scrollableElement, getScrollCoordinates(scrollableElement)];
        }
        return null;
      }).filter((entry) => entry != null);
      setScrollCoordinates(entries.length ? new Map(entries) : null);
      prevElements.current = elements;
    }
    return () => {
      cleanup(elements);
      cleanup(previousElements);
    };
    function cleanup(elements2) {
      elements2.forEach((element) => {
        const scrollableElement = getScrollableElement(element);
        scrollableElement == null ? void 0 : scrollableElement.removeEventListener("scroll", handleScroll);
      });
    }
  }, [handleScroll, elements]);
  return reactExports.useMemo(() => {
    if (elements.length) {
      return scrollCoordinates ? Array.from(scrollCoordinates.values()).reduce((acc, coordinates) => add(acc, coordinates), defaultCoordinates) : getScrollOffsets(elements);
    }
    return defaultCoordinates;
  }, [elements, scrollCoordinates]);
}
function useScrollOffsetsDelta(scrollOffsets, dependencies) {
  if (dependencies === void 0) {
    dependencies = [];
  }
  const initialScrollOffsets = reactExports.useRef(null);
  reactExports.useEffect(
    () => {
      initialScrollOffsets.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    dependencies
  );
  reactExports.useEffect(() => {
    const hasScrollOffsets = scrollOffsets !== defaultCoordinates;
    if (hasScrollOffsets && !initialScrollOffsets.current) {
      initialScrollOffsets.current = scrollOffsets;
    }
    if (!hasScrollOffsets && initialScrollOffsets.current) {
      initialScrollOffsets.current = null;
    }
  }, [scrollOffsets]);
  return initialScrollOffsets.current ? subtract(scrollOffsets, initialScrollOffsets.current) : defaultCoordinates;
}
function useSensorSetup(sensors) {
  reactExports.useEffect(
    () => {
      if (!canUseDOM) {
        return;
      }
      const teardownFns = sensors.map((_ref) => {
        let {
          sensor
        } = _ref;
        return sensor.setup == null ? void 0 : sensor.setup();
      });
      return () => {
        for (const teardown of teardownFns) {
          teardown == null ? void 0 : teardown();
        }
      };
    },
    // TO-DO: Sensors length could theoretically change which would not be a valid dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    sensors.map((_ref2) => {
      let {
        sensor
      } = _ref2;
      return sensor;
    })
  );
}
function useSyntheticListeners(listeners, id) {
  return reactExports.useMemo(() => {
    return listeners.reduce((acc, _ref) => {
      let {
        eventName,
        handler
      } = _ref;
      acc[eventName] = (event) => {
        handler(event, id);
      };
      return acc;
    }, {});
  }, [listeners, id]);
}
function useWindowRect(element) {
  return reactExports.useMemo(() => element ? getWindowClientRect(element) : null, [element]);
}
const defaultValue$2 = [];
function useRects(elements, measure) {
  if (measure === void 0) {
    measure = getClientRect;
  }
  const [firstElement] = elements;
  const windowRect = useWindowRect(firstElement ? getWindow(firstElement) : null);
  const [rects, setRects] = reactExports.useState(defaultValue$2);
  function measureRects() {
    setRects(() => {
      if (!elements.length) {
        return defaultValue$2;
      }
      return elements.map((element) => isDocumentScrollingElement(element) ? windowRect : new Rect(measure(element), element));
    });
  }
  const resizeObserver = useResizeObserver({
    callback: measureRects
  });
  useIsomorphicLayoutEffect(() => {
    resizeObserver == null ? void 0 : resizeObserver.disconnect();
    measureRects();
    elements.forEach((element) => resizeObserver == null ? void 0 : resizeObserver.observe(element));
  }, [elements]);
  return rects;
}
function getMeasurableNode(node) {
  if (!node) {
    return null;
  }
  if (node.children.length > 1) {
    return node;
  }
  const firstChild = node.children[0];
  return isHTMLElement(firstChild) ? firstChild : node;
}
function useDragOverlayMeasuring(_ref) {
  let {
    measure
  } = _ref;
  const [rect, setRect] = reactExports.useState(null);
  const handleResize = reactExports.useCallback((entries) => {
    for (const {
      target
    } of entries) {
      if (isHTMLElement(target)) {
        setRect((rect2) => {
          const newRect = measure(target);
          return rect2 ? {
            ...rect2,
            width: newRect.width,
            height: newRect.height
          } : newRect;
        });
        break;
      }
    }
  }, [measure]);
  const resizeObserver = useResizeObserver({
    callback: handleResize
  });
  const handleNodeChange = reactExports.useCallback((element) => {
    const node = getMeasurableNode(element);
    resizeObserver == null ? void 0 : resizeObserver.disconnect();
    if (node) {
      resizeObserver == null ? void 0 : resizeObserver.observe(node);
    }
    setRect(node ? measure(node) : null);
  }, [measure, resizeObserver]);
  const [nodeRef, setRef] = useNodeRef(handleNodeChange);
  return reactExports.useMemo(() => ({
    nodeRef,
    rect,
    setRef
  }), [rect, nodeRef, setRef]);
}
const defaultSensors = [{
  sensor: PointerSensor,
  options: {}
}, {
  sensor: KeyboardSensor,
  options: {}
}];
const defaultData = {
  current: {}
};
const defaultMeasuringConfiguration = {
  draggable: {
    measure: getTransformAgnosticClientRect
  },
  droppable: {
    measure: getTransformAgnosticClientRect,
    strategy: MeasuringStrategy.WhileDragging,
    frequency: MeasuringFrequency.Optimized
  },
  dragOverlay: {
    measure: getClientRect
  }
};
class DroppableContainersMap extends Map {
  get(id) {
    var _super$get;
    return id != null ? (_super$get = super.get(id)) != null ? _super$get : void 0 : void 0;
  }
  toArray() {
    return Array.from(this.values());
  }
  getEnabled() {
    return this.toArray().filter((_ref) => {
      let {
        disabled
      } = _ref;
      return !disabled;
    });
  }
  getNodeFor(id) {
    var _this$get$node$curren, _this$get;
    return (_this$get$node$curren = (_this$get = this.get(id)) == null ? void 0 : _this$get.node.current) != null ? _this$get$node$curren : void 0;
  }
}
const defaultPublicContext = {
  activatorEvent: null,
  active: null,
  activeNode: null,
  activeNodeRect: null,
  collisions: null,
  containerNodeRect: null,
  draggableNodes: /* @__PURE__ */ new Map(),
  droppableRects: /* @__PURE__ */ new Map(),
  droppableContainers: /* @__PURE__ */ new DroppableContainersMap(),
  over: null,
  dragOverlay: {
    nodeRef: {
      current: null
    },
    rect: null,
    setRef: noop
  },
  scrollableAncestors: [],
  scrollableAncestorRects: [],
  measuringConfiguration: defaultMeasuringConfiguration,
  measureDroppableContainers: noop,
  windowRect: null,
  measuringScheduled: false
};
const defaultInternalContext = {
  activatorEvent: null,
  activators: [],
  active: null,
  activeNodeRect: null,
  ariaDescribedById: {
    draggable: ""
  },
  dispatch: noop,
  draggableNodes: /* @__PURE__ */ new Map(),
  over: null,
  measureDroppableContainers: noop
};
const InternalContext = /* @__PURE__ */ reactExports.createContext(defaultInternalContext);
const PublicContext = /* @__PURE__ */ reactExports.createContext(defaultPublicContext);
function getInitialState() {
  return {
    draggable: {
      active: null,
      initialCoordinates: {
        x: 0,
        y: 0
      },
      nodes: /* @__PURE__ */ new Map(),
      translate: {
        x: 0,
        y: 0
      }
    },
    droppable: {
      containers: new DroppableContainersMap()
    }
  };
}
function reducer(state, action) {
  switch (action.type) {
    case Action.DragStart:
      return {
        ...state,
        draggable: {
          ...state.draggable,
          initialCoordinates: action.initialCoordinates,
          active: action.active
        }
      };
    case Action.DragMove:
      if (state.draggable.active == null) {
        return state;
      }
      return {
        ...state,
        draggable: {
          ...state.draggable,
          translate: {
            x: action.coordinates.x - state.draggable.initialCoordinates.x,
            y: action.coordinates.y - state.draggable.initialCoordinates.y
          }
        }
      };
    case Action.DragEnd:
    case Action.DragCancel:
      return {
        ...state,
        draggable: {
          ...state.draggable,
          active: null,
          initialCoordinates: {
            x: 0,
            y: 0
          },
          translate: {
            x: 0,
            y: 0
          }
        }
      };
    case Action.RegisterDroppable: {
      const {
        element
      } = action;
      const {
        id
      } = element;
      const containers = new DroppableContainersMap(state.droppable.containers);
      containers.set(id, element);
      return {
        ...state,
        droppable: {
          ...state.droppable,
          containers
        }
      };
    }
    case Action.SetDroppableDisabled: {
      const {
        id,
        key,
        disabled
      } = action;
      const element = state.droppable.containers.get(id);
      if (!element || key !== element.key) {
        return state;
      }
      const containers = new DroppableContainersMap(state.droppable.containers);
      containers.set(id, {
        ...element,
        disabled
      });
      return {
        ...state,
        droppable: {
          ...state.droppable,
          containers
        }
      };
    }
    case Action.UnregisterDroppable: {
      const {
        id,
        key
      } = action;
      const element = state.droppable.containers.get(id);
      if (!element || key !== element.key) {
        return state;
      }
      const containers = new DroppableContainersMap(state.droppable.containers);
      containers.delete(id);
      return {
        ...state,
        droppable: {
          ...state.droppable,
          containers
        }
      };
    }
    default: {
      return state;
    }
  }
}
function RestoreFocus(_ref) {
  let {
    disabled
  } = _ref;
  const {
    active,
    activatorEvent,
    draggableNodes
  } = reactExports.useContext(InternalContext);
  const previousActivatorEvent = usePrevious(activatorEvent);
  const previousActiveId = usePrevious(active == null ? void 0 : active.id);
  reactExports.useEffect(() => {
    if (disabled) {
      return;
    }
    if (!activatorEvent && previousActivatorEvent && previousActiveId != null) {
      if (!isKeyboardEvent(previousActivatorEvent)) {
        return;
      }
      if (document.activeElement === previousActivatorEvent.target) {
        return;
      }
      const draggableNode = draggableNodes.get(previousActiveId);
      if (!draggableNode) {
        return;
      }
      const {
        activatorNode,
        node
      } = draggableNode;
      if (!activatorNode.current && !node.current) {
        return;
      }
      requestAnimationFrame(() => {
        for (const element of [activatorNode.current, node.current]) {
          if (!element) {
            continue;
          }
          const focusableNode = findFirstFocusableNode(element);
          if (focusableNode) {
            focusableNode.focus();
            break;
          }
        }
      });
    }
  }, [activatorEvent, disabled, draggableNodes, previousActiveId, previousActivatorEvent]);
  return null;
}
function applyModifiers(modifiers, _ref) {
  let {
    transform,
    ...args
  } = _ref;
  return modifiers != null && modifiers.length ? modifiers.reduce((accumulator, modifier) => {
    return modifier({
      transform: accumulator,
      ...args
    });
  }, transform) : transform;
}
function useMeasuringConfiguration(config) {
  return reactExports.useMemo(
    () => ({
      draggable: {
        ...defaultMeasuringConfiguration.draggable,
        ...config == null ? void 0 : config.draggable
      },
      droppable: {
        ...defaultMeasuringConfiguration.droppable,
        ...config == null ? void 0 : config.droppable
      },
      dragOverlay: {
        ...defaultMeasuringConfiguration.dragOverlay,
        ...config == null ? void 0 : config.dragOverlay
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config == null ? void 0 : config.draggable, config == null ? void 0 : config.droppable, config == null ? void 0 : config.dragOverlay]
  );
}
function useLayoutShiftScrollCompensation(_ref) {
  let {
    activeNode,
    measure,
    initialRect,
    config = true
  } = _ref;
  const initialized2 = reactExports.useRef(false);
  const {
    x,
    y
  } = typeof config === "boolean" ? {
    x: config,
    y: config
  } : config;
  useIsomorphicLayoutEffect(() => {
    const disabled = !x && !y;
    if (disabled || !activeNode) {
      initialized2.current = false;
      return;
    }
    if (initialized2.current || !initialRect) {
      return;
    }
    const node = activeNode == null ? void 0 : activeNode.node.current;
    if (!node || node.isConnected === false) {
      return;
    }
    const rect = measure(node);
    const rectDelta = getRectDelta(rect, initialRect);
    if (!x) {
      rectDelta.x = 0;
    }
    if (!y) {
      rectDelta.y = 0;
    }
    initialized2.current = true;
    if (Math.abs(rectDelta.x) > 0 || Math.abs(rectDelta.y) > 0) {
      const firstScrollableAncestor = getFirstScrollableAncestor(node);
      if (firstScrollableAncestor) {
        firstScrollableAncestor.scrollBy({
          top: rectDelta.y,
          left: rectDelta.x
        });
      }
    }
  }, [activeNode, x, y, initialRect, measure]);
}
const ActiveDraggableContext = /* @__PURE__ */ reactExports.createContext({
  ...defaultCoordinates,
  scaleX: 1,
  scaleY: 1
});
var Status;
(function(Status2) {
  Status2[Status2["Uninitialized"] = 0] = "Uninitialized";
  Status2[Status2["Initializing"] = 1] = "Initializing";
  Status2[Status2["Initialized"] = 2] = "Initialized";
})(Status || (Status = {}));
const DndContext = /* @__PURE__ */ reactExports.memo(function DndContext2(_ref) {
  var _sensorContext$curren, _dragOverlay$nodeRef$, _dragOverlay$rect, _over$rect;
  let {
    id,
    accessibility,
    autoScroll = true,
    children,
    sensors = defaultSensors,
    collisionDetection = rectIntersection,
    measuring,
    modifiers,
    ...props
  } = _ref;
  const store = reactExports.useReducer(reducer, void 0, getInitialState);
  const [state, dispatch] = store;
  const [dispatchMonitorEvent, registerMonitorListener] = useDndMonitorProvider();
  const [status, setStatus] = reactExports.useState(Status.Uninitialized);
  const isInitialized = status === Status.Initialized;
  const {
    draggable: {
      active: activeId,
      nodes: draggableNodes,
      translate
    },
    droppable: {
      containers: droppableContainers
    }
  } = state;
  const node = activeId != null ? draggableNodes.get(activeId) : null;
  const activeRects = reactExports.useRef({
    initial: null,
    translated: null
  });
  const active = reactExports.useMemo(() => {
    var _node$data;
    return activeId != null ? {
      id: activeId,
      // It's possible for the active node to unmount while dragging
      data: (_node$data = node == null ? void 0 : node.data) != null ? _node$data : defaultData,
      rect: activeRects
    } : null;
  }, [activeId, node]);
  const activeRef = reactExports.useRef(null);
  const [activeSensor, setActiveSensor] = reactExports.useState(null);
  const [activatorEvent, setActivatorEvent] = reactExports.useState(null);
  const latestProps = useLatestValue(props, Object.values(props));
  const draggableDescribedById = useUniqueId("DndDescribedBy", id);
  const enabledDroppableContainers = reactExports.useMemo(() => droppableContainers.getEnabled(), [droppableContainers]);
  const measuringConfiguration = useMeasuringConfiguration(measuring);
  const {
    droppableRects,
    measureDroppableContainers,
    measuringScheduled
  } = useDroppableMeasuring(enabledDroppableContainers, {
    dragging: isInitialized,
    dependencies: [translate.x, translate.y],
    config: measuringConfiguration.droppable
  });
  const activeNode = useCachedNode(draggableNodes, activeId);
  const activationCoordinates = reactExports.useMemo(() => activatorEvent ? getEventCoordinates(activatorEvent) : null, [activatorEvent]);
  const autoScrollOptions = getAutoScrollerOptions();
  const initialActiveNodeRect = useInitialRect(activeNode, measuringConfiguration.draggable.measure);
  useLayoutShiftScrollCompensation({
    activeNode: activeId != null ? draggableNodes.get(activeId) : null,
    config: autoScrollOptions.layoutShiftCompensation,
    initialRect: initialActiveNodeRect,
    measure: measuringConfiguration.draggable.measure
  });
  const activeNodeRect = useRect(activeNode, measuringConfiguration.draggable.measure, initialActiveNodeRect);
  const containerNodeRect = useRect(activeNode ? activeNode.parentElement : null);
  const sensorContext = reactExports.useRef({
    activatorEvent: null,
    active: null,
    activeNode,
    collisionRect: null,
    collisions: null,
    droppableRects,
    draggableNodes,
    draggingNode: null,
    draggingNodeRect: null,
    droppableContainers,
    over: null,
    scrollableAncestors: [],
    scrollAdjustedTranslate: null
  });
  const overNode = droppableContainers.getNodeFor((_sensorContext$curren = sensorContext.current.over) == null ? void 0 : _sensorContext$curren.id);
  const dragOverlay = useDragOverlayMeasuring({
    measure: measuringConfiguration.dragOverlay.measure
  });
  const draggingNode = (_dragOverlay$nodeRef$ = dragOverlay.nodeRef.current) != null ? _dragOverlay$nodeRef$ : activeNode;
  const draggingNodeRect = isInitialized ? (_dragOverlay$rect = dragOverlay.rect) != null ? _dragOverlay$rect : activeNodeRect : null;
  const usesDragOverlay = Boolean(dragOverlay.nodeRef.current && dragOverlay.rect);
  const nodeRectDelta = useRectDelta(usesDragOverlay ? null : activeNodeRect);
  const windowRect = useWindowRect(draggingNode ? getWindow(draggingNode) : null);
  const scrollableAncestors = useScrollableAncestors(isInitialized ? overNode != null ? overNode : activeNode : null);
  const scrollableAncestorRects = useRects(scrollableAncestors);
  const modifiedTranslate = applyModifiers(modifiers, {
    transform: {
      x: translate.x - nodeRectDelta.x,
      y: translate.y - nodeRectDelta.y,
      scaleX: 1,
      scaleY: 1
    },
    activatorEvent,
    active,
    activeNodeRect,
    containerNodeRect,
    draggingNodeRect,
    over: sensorContext.current.over,
    overlayNodeRect: dragOverlay.rect,
    scrollableAncestors,
    scrollableAncestorRects,
    windowRect
  });
  const pointerCoordinates = activationCoordinates ? add(activationCoordinates, translate) : null;
  const scrollOffsets = useScrollOffsets(scrollableAncestors);
  const scrollAdjustment = useScrollOffsetsDelta(scrollOffsets);
  const activeNodeScrollDelta = useScrollOffsetsDelta(scrollOffsets, [activeNodeRect]);
  const scrollAdjustedTranslate = add(modifiedTranslate, scrollAdjustment);
  const collisionRect = draggingNodeRect ? getAdjustedRect(draggingNodeRect, modifiedTranslate) : null;
  const collisions = active && collisionRect ? collisionDetection({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: enabledDroppableContainers,
    pointerCoordinates
  }) : null;
  const overId = getFirstCollision(collisions, "id");
  const [over, setOver] = reactExports.useState(null);
  const appliedTranslate = usesDragOverlay ? modifiedTranslate : add(modifiedTranslate, activeNodeScrollDelta);
  const transform = adjustScale(appliedTranslate, (_over$rect = over == null ? void 0 : over.rect) != null ? _over$rect : null, activeNodeRect);
  const activeSensorRef = reactExports.useRef(null);
  const instantiateSensor = reactExports.useCallback(
    (event, _ref2) => {
      let {
        sensor: Sensor,
        options
      } = _ref2;
      if (activeRef.current == null) {
        return;
      }
      const activeNode2 = draggableNodes.get(activeRef.current);
      if (!activeNode2) {
        return;
      }
      const activatorEvent2 = event.nativeEvent;
      const sensorInstance = new Sensor({
        active: activeRef.current,
        activeNode: activeNode2,
        event: activatorEvent2,
        options,
        // Sensors need to be instantiated with refs for arguments that change over time
        // otherwise they are frozen in time with the stale arguments
        context: sensorContext,
        onAbort(id2) {
          const draggableNode = draggableNodes.get(id2);
          if (!draggableNode) {
            return;
          }
          const {
            onDragAbort
          } = latestProps.current;
          const event2 = {
            id: id2
          };
          onDragAbort == null ? void 0 : onDragAbort(event2);
          dispatchMonitorEvent({
            type: "onDragAbort",
            event: event2
          });
        },
        onPending(id2, constraint, initialCoordinates, offset) {
          const draggableNode = draggableNodes.get(id2);
          if (!draggableNode) {
            return;
          }
          const {
            onDragPending
          } = latestProps.current;
          const event2 = {
            id: id2,
            constraint,
            initialCoordinates,
            offset
          };
          onDragPending == null ? void 0 : onDragPending(event2);
          dispatchMonitorEvent({
            type: "onDragPending",
            event: event2
          });
        },
        onStart(initialCoordinates) {
          const id2 = activeRef.current;
          if (id2 == null) {
            return;
          }
          const draggableNode = draggableNodes.get(id2);
          if (!draggableNode) {
            return;
          }
          const {
            onDragStart
          } = latestProps.current;
          const event2 = {
            activatorEvent: activatorEvent2,
            active: {
              id: id2,
              data: draggableNode.data,
              rect: activeRects
            }
          };
          reactDomExports.unstable_batchedUpdates(() => {
            onDragStart == null ? void 0 : onDragStart(event2);
            setStatus(Status.Initializing);
            dispatch({
              type: Action.DragStart,
              initialCoordinates,
              active: id2
            });
            dispatchMonitorEvent({
              type: "onDragStart",
              event: event2
            });
            setActiveSensor(activeSensorRef.current);
            setActivatorEvent(activatorEvent2);
          });
        },
        onMove(coordinates) {
          dispatch({
            type: Action.DragMove,
            coordinates
          });
        },
        onEnd: createHandler(Action.DragEnd),
        onCancel: createHandler(Action.DragCancel)
      });
      activeSensorRef.current = sensorInstance;
      function createHandler(type) {
        return async function handler() {
          const {
            active: active2,
            collisions: collisions2,
            over: over2,
            scrollAdjustedTranslate: scrollAdjustedTranslate2
          } = sensorContext.current;
          let event2 = null;
          if (active2 && scrollAdjustedTranslate2) {
            const {
              cancelDrop
            } = latestProps.current;
            event2 = {
              activatorEvent: activatorEvent2,
              active: active2,
              collisions: collisions2,
              delta: scrollAdjustedTranslate2,
              over: over2
            };
            if (type === Action.DragEnd && typeof cancelDrop === "function") {
              const shouldCancel = await Promise.resolve(cancelDrop(event2));
              if (shouldCancel) {
                type = Action.DragCancel;
              }
            }
          }
          activeRef.current = null;
          reactDomExports.unstable_batchedUpdates(() => {
            dispatch({
              type
            });
            setStatus(Status.Uninitialized);
            setOver(null);
            setActiveSensor(null);
            setActivatorEvent(null);
            activeSensorRef.current = null;
            const eventName = type === Action.DragEnd ? "onDragEnd" : "onDragCancel";
            if (event2) {
              const handler2 = latestProps.current[eventName];
              handler2 == null ? void 0 : handler2(event2);
              dispatchMonitorEvent({
                type: eventName,
                event: event2
              });
            }
          });
        };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draggableNodes]
  );
  const bindActivatorToSensorInstantiator = reactExports.useCallback((handler, sensor) => {
    return (event, active2) => {
      const nativeEvent = event.nativeEvent;
      const activeDraggableNode = draggableNodes.get(active2);
      if (
        // Another sensor is already instantiating
        activeRef.current !== null || // No active draggable
        !activeDraggableNode || // Event has already been captured
        nativeEvent.dndKit || nativeEvent.defaultPrevented
      ) {
        return;
      }
      const activationContext = {
        active: activeDraggableNode
      };
      const shouldActivate = handler(event, sensor.options, activationContext);
      if (shouldActivate === true) {
        nativeEvent.dndKit = {
          capturedBy: sensor.sensor
        };
        activeRef.current = active2;
        instantiateSensor(event, sensor);
      }
    };
  }, [draggableNodes, instantiateSensor]);
  const activators = useCombineActivators(sensors, bindActivatorToSensorInstantiator);
  useSensorSetup(sensors);
  useIsomorphicLayoutEffect(() => {
    if (activeNodeRect && status === Status.Initializing) {
      setStatus(Status.Initialized);
    }
  }, [activeNodeRect, status]);
  reactExports.useEffect(
    () => {
      const {
        onDragMove
      } = latestProps.current;
      const {
        active: active2,
        activatorEvent: activatorEvent2,
        collisions: collisions2,
        over: over2
      } = sensorContext.current;
      if (!active2 || !activatorEvent2) {
        return;
      }
      const event = {
        active: active2,
        activatorEvent: activatorEvent2,
        collisions: collisions2,
        delta: {
          x: scrollAdjustedTranslate.x,
          y: scrollAdjustedTranslate.y
        },
        over: over2
      };
      reactDomExports.unstable_batchedUpdates(() => {
        onDragMove == null ? void 0 : onDragMove(event);
        dispatchMonitorEvent({
          type: "onDragMove",
          event
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollAdjustedTranslate.x, scrollAdjustedTranslate.y]
  );
  reactExports.useEffect(
    () => {
      const {
        active: active2,
        activatorEvent: activatorEvent2,
        collisions: collisions2,
        droppableContainers: droppableContainers2,
        scrollAdjustedTranslate: scrollAdjustedTranslate2
      } = sensorContext.current;
      if (!active2 || activeRef.current == null || !activatorEvent2 || !scrollAdjustedTranslate2) {
        return;
      }
      const {
        onDragOver
      } = latestProps.current;
      const overContainer = droppableContainers2.get(overId);
      const over2 = overContainer && overContainer.rect.current ? {
        id: overContainer.id,
        rect: overContainer.rect.current,
        data: overContainer.data,
        disabled: overContainer.disabled
      } : null;
      const event = {
        active: active2,
        activatorEvent: activatorEvent2,
        collisions: collisions2,
        delta: {
          x: scrollAdjustedTranslate2.x,
          y: scrollAdjustedTranslate2.y
        },
        over: over2
      };
      reactDomExports.unstable_batchedUpdates(() => {
        setOver(over2);
        onDragOver == null ? void 0 : onDragOver(event);
        dispatchMonitorEvent({
          type: "onDragOver",
          event
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overId]
  );
  useIsomorphicLayoutEffect(() => {
    sensorContext.current = {
      activatorEvent,
      active,
      activeNode,
      collisionRect,
      collisions,
      droppableRects,
      draggableNodes,
      draggingNode,
      draggingNodeRect,
      droppableContainers,
      over,
      scrollableAncestors,
      scrollAdjustedTranslate
    };
    activeRects.current = {
      initial: draggingNodeRect,
      translated: collisionRect
    };
  }, [active, activeNode, collisions, collisionRect, draggableNodes, draggingNode, draggingNodeRect, droppableRects, droppableContainers, over, scrollableAncestors, scrollAdjustedTranslate]);
  useAutoScroller({
    ...autoScrollOptions,
    delta: translate,
    draggingRect: collisionRect,
    pointerCoordinates,
    scrollableAncestors,
    scrollableAncestorRects
  });
  const publicContext = reactExports.useMemo(() => {
    const context = {
      active,
      activeNode,
      activeNodeRect,
      activatorEvent,
      collisions,
      containerNodeRect,
      dragOverlay,
      draggableNodes,
      droppableContainers,
      droppableRects,
      over,
      measureDroppableContainers,
      scrollableAncestors,
      scrollableAncestorRects,
      measuringConfiguration,
      measuringScheduled,
      windowRect
    };
    return context;
  }, [active, activeNode, activeNodeRect, activatorEvent, collisions, containerNodeRect, dragOverlay, draggableNodes, droppableContainers, droppableRects, over, measureDroppableContainers, scrollableAncestors, scrollableAncestorRects, measuringConfiguration, measuringScheduled, windowRect]);
  const internalContext = reactExports.useMemo(() => {
    const context = {
      activatorEvent,
      activators,
      active,
      activeNodeRect,
      ariaDescribedById: {
        draggable: draggableDescribedById
      },
      dispatch,
      draggableNodes,
      over,
      measureDroppableContainers
    };
    return context;
  }, [activatorEvent, activators, active, activeNodeRect, dispatch, draggableDescribedById, draggableNodes, over, measureDroppableContainers]);
  return React.createElement(DndMonitorContext.Provider, {
    value: registerMonitorListener
  }, React.createElement(InternalContext.Provider, {
    value: internalContext
  }, React.createElement(PublicContext.Provider, {
    value: publicContext
  }, React.createElement(ActiveDraggableContext.Provider, {
    value: transform
  }, children)), React.createElement(RestoreFocus, {
    disabled: (accessibility == null ? void 0 : accessibility.restoreFocus) === false
  })), React.createElement(Accessibility, {
    ...accessibility,
    hiddenTextDescribedById: draggableDescribedById
  }));
  function getAutoScrollerOptions() {
    const activeSensorDisablesAutoscroll = (activeSensor == null ? void 0 : activeSensor.autoScrollEnabled) === false;
    const autoScrollGloballyDisabled = typeof autoScroll === "object" ? autoScroll.enabled === false : autoScroll === false;
    const enabled = isInitialized && !activeSensorDisablesAutoscroll && !autoScrollGloballyDisabled;
    if (typeof autoScroll === "object") {
      return {
        ...autoScroll,
        enabled
      };
    }
    return {
      enabled
    };
  }
});
const NullContext = /* @__PURE__ */ reactExports.createContext(null);
const defaultRole = "button";
const ID_PREFIX$1 = "Draggable";
function useDraggable(_ref) {
  let {
    id,
    data,
    disabled = false,
    attributes
  } = _ref;
  const key = useUniqueId(ID_PREFIX$1);
  const {
    activators,
    activatorEvent,
    active,
    activeNodeRect,
    ariaDescribedById,
    draggableNodes,
    over
  } = reactExports.useContext(InternalContext);
  const {
    role = defaultRole,
    roleDescription = "draggable",
    tabIndex = 0
  } = attributes != null ? attributes : {};
  const isDragging = (active == null ? void 0 : active.id) === id;
  const transform = reactExports.useContext(isDragging ? ActiveDraggableContext : NullContext);
  const [node, setNodeRef] = useNodeRef();
  const [activatorNode, setActivatorNodeRef] = useNodeRef();
  const listeners = useSyntheticListeners(activators, id);
  const dataRef = useLatestValue(data);
  useIsomorphicLayoutEffect(
    () => {
      draggableNodes.set(id, {
        id,
        key,
        node,
        activatorNode,
        data: dataRef
      });
      return () => {
        const node2 = draggableNodes.get(id);
        if (node2 && node2.key === key) {
          draggableNodes.delete(id);
        }
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draggableNodes, id]
  );
  const memoizedAttributes = reactExports.useMemo(() => ({
    role,
    tabIndex,
    "aria-disabled": disabled,
    "aria-pressed": isDragging && role === defaultRole ? true : void 0,
    "aria-roledescription": roleDescription,
    "aria-describedby": ariaDescribedById.draggable
  }), [disabled, role, tabIndex, isDragging, roleDescription, ariaDescribedById.draggable]);
  return {
    active,
    activatorEvent,
    activeNodeRect,
    attributes: memoizedAttributes,
    isDragging,
    listeners: disabled ? void 0 : listeners,
    node,
    over,
    setNodeRef,
    setActivatorNodeRef,
    transform
  };
}
function useDndContext() {
  return reactExports.useContext(PublicContext);
}
const ID_PREFIX$1$1 = "Droppable";
const defaultResizeObserverConfig = {
  timeout: 25
};
function useDroppable(_ref) {
  let {
    data,
    disabled = false,
    id,
    resizeObserverConfig
  } = _ref;
  const key = useUniqueId(ID_PREFIX$1$1);
  const {
    active,
    dispatch,
    over,
    measureDroppableContainers
  } = reactExports.useContext(InternalContext);
  const previous = reactExports.useRef({
    disabled
  });
  const resizeObserverConnected = reactExports.useRef(false);
  const rect = reactExports.useRef(null);
  const callbackId = reactExports.useRef(null);
  const {
    disabled: resizeObserverDisabled,
    updateMeasurementsFor,
    timeout: resizeObserverTimeout
  } = {
    ...defaultResizeObserverConfig,
    ...resizeObserverConfig
  };
  const ids2 = useLatestValue(updateMeasurementsFor != null ? updateMeasurementsFor : id);
  const handleResize = reactExports.useCallback(
    () => {
      if (!resizeObserverConnected.current) {
        resizeObserverConnected.current = true;
        return;
      }
      if (callbackId.current != null) {
        clearTimeout(callbackId.current);
      }
      callbackId.current = setTimeout(() => {
        measureDroppableContainers(Array.isArray(ids2.current) ? ids2.current : [ids2.current]);
        callbackId.current = null;
      }, resizeObserverTimeout);
    },
    //eslint-disable-next-line react-hooks/exhaustive-deps
    [resizeObserverTimeout]
  );
  const resizeObserver = useResizeObserver({
    callback: handleResize,
    disabled: resizeObserverDisabled || !active
  });
  const handleNodeChange = reactExports.useCallback((newElement, previousElement) => {
    if (!resizeObserver) {
      return;
    }
    if (previousElement) {
      resizeObserver.unobserve(previousElement);
      resizeObserverConnected.current = false;
    }
    if (newElement) {
      resizeObserver.observe(newElement);
    }
  }, [resizeObserver]);
  const [nodeRef, setNodeRef] = useNodeRef(handleNodeChange);
  const dataRef = useLatestValue(data);
  reactExports.useEffect(() => {
    if (!resizeObserver || !nodeRef.current) {
      return;
    }
    resizeObserver.disconnect();
    resizeObserverConnected.current = false;
    resizeObserver.observe(nodeRef.current);
  }, [nodeRef, resizeObserver]);
  reactExports.useEffect(
    () => {
      dispatch({
        type: Action.RegisterDroppable,
        element: {
          id,
          key,
          disabled,
          node: nodeRef,
          rect,
          data: dataRef
        }
      });
      return () => dispatch({
        type: Action.UnregisterDroppable,
        key,
        id
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]
  );
  reactExports.useEffect(() => {
    if (disabled !== previous.current.disabled) {
      dispatch({
        type: Action.SetDroppableDisabled,
        id,
        key,
        disabled
      });
      previous.current.disabled = disabled;
    }
  }, [id, key, disabled, dispatch]);
  return {
    active,
    rect,
    isOver: (over == null ? void 0 : over.id) === id,
    node: nodeRef,
    over,
    setNodeRef
  };
}
const __vite_import_meta_env__$2 = {};
const createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState2 = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const destroy = () => {
    if ((__vite_import_meta_env__$2 ? "production" : void 0) !== "production") {
      console.warn(
        "[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."
      );
    }
    listeners.clear();
  };
  const api = { setState, getState, getInitialState: getInitialState2, subscribe, destroy };
  const initialState = state = createState(setState, getState, api);
  return api;
};
const createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;
var withSelector = { exports: {} };
var withSelector_production = {};
var shim = { exports: {} };
var useSyncExternalStoreShim_production = {};
var hasRequiredUseSyncExternalStoreShim_production;
function requireUseSyncExternalStoreShim_production() {
  if (hasRequiredUseSyncExternalStoreShim_production) return useSyncExternalStoreShim_production;
  hasRequiredUseSyncExternalStoreShim_production = 1;
  var React2 = requireReact();
  function is(x, y) {
    return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
  }
  var objectIs = "function" === typeof Object.is ? Object.is : is, useState = React2.useState, useEffect = React2.useEffect, useLayoutEffect = React2.useLayoutEffect, useDebugValue2 = React2.useDebugValue;
  function useSyncExternalStore$2(subscribe, getSnapshot) {
    var value = getSnapshot(), _useState = useState({ inst: { value, getSnapshot } }), inst = _useState[0].inst, forceUpdate = _useState[1];
    useLayoutEffect(
      function() {
        inst.value = value;
        inst.getSnapshot = getSnapshot;
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
      },
      [subscribe, value, getSnapshot]
    );
    useEffect(
      function() {
        checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        return subscribe(function() {
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        });
      },
      [subscribe]
    );
    useDebugValue2(value);
    return value;
  }
  function checkIfSnapshotChanged(inst) {
    var latestGetSnapshot = inst.getSnapshot;
    inst = inst.value;
    try {
      var nextValue = latestGetSnapshot();
      return !objectIs(inst, nextValue);
    } catch (error) {
      return true;
    }
  }
  function useSyncExternalStore$1(subscribe, getSnapshot) {
    return getSnapshot();
  }
  var shim2 = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
  useSyncExternalStoreShim_production.useSyncExternalStore = void 0 !== React2.useSyncExternalStore ? React2.useSyncExternalStore : shim2;
  return useSyncExternalStoreShim_production;
}
var hasRequiredShim;
function requireShim() {
  if (hasRequiredShim) return shim.exports;
  hasRequiredShim = 1;
  {
    shim.exports = requireUseSyncExternalStoreShim_production();
  }
  return shim.exports;
}
var hasRequiredWithSelector_production;
function requireWithSelector_production() {
  if (hasRequiredWithSelector_production) return withSelector_production;
  hasRequiredWithSelector_production = 1;
  var React2 = requireReact(), shim2 = requireShim();
  function is(x, y) {
    return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
  }
  var objectIs = "function" === typeof Object.is ? Object.is : is, useSyncExternalStore = shim2.useSyncExternalStore, useRef = React2.useRef, useEffect = React2.useEffect, useMemo = React2.useMemo, useDebugValue2 = React2.useDebugValue;
  withSelector_production.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
    var instRef = useRef(null);
    if (null === instRef.current) {
      var inst = { hasValue: false, value: null };
      instRef.current = inst;
    } else inst = instRef.current;
    instRef = useMemo(
      function() {
        function memoizedSelector(nextSnapshot) {
          if (!hasMemo) {
            hasMemo = true;
            memoizedSnapshot = nextSnapshot;
            nextSnapshot = selector(nextSnapshot);
            if (void 0 !== isEqual && inst.hasValue) {
              var currentSelection = inst.value;
              if (isEqual(currentSelection, nextSnapshot))
                return memoizedSelection = currentSelection;
            }
            return memoizedSelection = nextSnapshot;
          }
          currentSelection = memoizedSelection;
          if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
          var nextSelection = selector(nextSnapshot);
          if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
            return memoizedSnapshot = nextSnapshot, currentSelection;
          memoizedSnapshot = nextSnapshot;
          return memoizedSelection = nextSelection;
        }
        var hasMemo = false, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
        return [
          function() {
            return memoizedSelector(getSnapshot());
          },
          null === maybeGetServerSnapshot ? void 0 : function() {
            return memoizedSelector(maybeGetServerSnapshot());
          }
        ];
      },
      [getSnapshot, getServerSnapshot, selector, isEqual]
    );
    var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
    useEffect(
      function() {
        inst.hasValue = true;
        inst.value = value;
      },
      [value]
    );
    useDebugValue2(value);
    return value;
  };
  return withSelector_production;
}
var hasRequiredWithSelector;
function requireWithSelector() {
  if (hasRequiredWithSelector) return withSelector.exports;
  hasRequiredWithSelector = 1;
  {
    withSelector.exports = requireWithSelector_production();
  }
  return withSelector.exports;
}
var withSelectorExports = requireWithSelector();
const useSyncExternalStoreExports = /* @__PURE__ */ getDefaultExportFromCjs(withSelectorExports);
const __vite_import_meta_env__$1 = {};
const { useDebugValue } = React;
const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;
let didWarnAboutEqualityFn = false;
const identity = (arg) => arg;
function useStore(api, selector = identity, equalityFn) {
  if ((__vite_import_meta_env__$1 ? "production" : void 0) !== "production" && equalityFn && !didWarnAboutEqualityFn) {
    console.warn(
      "[DEPRECATED] Use `createWithEqualityFn` instead of `create` or use `useStoreWithEqualityFn` instead of `useStore`. They can be imported from 'zustand/traditional'. https://github.com/pmndrs/zustand/discussions/1937"
    );
    didWarnAboutEqualityFn = true;
  }
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getServerState || api.getInitialState,
    selector,
    equalityFn
  );
  useDebugValue(slice);
  return slice;
}
const createImpl = (createState) => {
  if ((__vite_import_meta_env__$1 ? "production" : void 0) !== "production" && typeof createState !== "function") {
    console.warn(
      "[DEPRECATED] Passing a vanilla store will be unsupported in a future version. Instead use `import { useStore } from 'zustand'`."
    );
  }
  const api = typeof createState === "function" ? createStore(createState) : createState;
  const useBoundStore = (selector, equalityFn) => useStore(api, selector, equalityFn);
  Object.assign(useBoundStore, api);
  return useBoundStore;
};
const create = (createState) => createState ? createImpl(createState) : createImpl;
const useSongsStore = create((set) => ({
  songs: [],
  loading: false,
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
  fetchSongs: async (query) => {
    set({ loading: true });
    const songs = await window.api.getSongs(query);
    set({ songs, loading: false });
  },
  saveSong: async (song) => {
    const id = await window.api.saveSong(song);
    const songs = await window.api.getSongs();
    set({ songs });
    return id;
  },
  deleteSong: async (id) => {
    await window.api.deleteSong(id);
    const songs = await window.api.getSongs();
    set({ songs });
  }
}));
const useFoldersStore = create((set, get) => ({
  folders: [],
  currentFolderId: null,
  songsInView: [],
  loading: false,
  fetchFolders: async () => {
    const folders = await window.api.getFolders();
    set({ folders });
  },
  createFolder: async (name) => {
    await window.api.createFolder(name);
    const folders = await window.api.getFolders();
    set({ folders });
  },
  renameFolder: async (id, name) => {
    await window.api.renameFolder(id, name);
    const folders = await window.api.getFolders();
    set({ folders });
  },
  deleteFolder: async (id) => {
    await window.api.deleteFolder(id);
    const folders = await window.api.getFolders();
    const { currentFolderId } = get();
    if (currentFolderId === id) {
      const songsInView = await window.api.getSongsInFolder(null);
      set({ folders, currentFolderId: null, songsInView });
    } else {
      set({ folders });
    }
  },
  enterFolder: async (folderId) => {
    set({ loading: true });
    const songsInView = await window.api.getSongsInFolder(folderId);
    set({ currentFolderId: folderId, songsInView, loading: false });
  },
  moveSongToFolder: async (songId, folderId) => {
    await window.api.moveSongToFolder(songId, folderId);
    const { currentFolderId } = get();
    const songsInView = await window.api.getSongsInFolder(currentFolderId);
    set({ songsInView });
  },
  refreshSongsInView: async () => {
    const { currentFolderId } = get();
    const songsInView = await window.api.getSongsInFolder(currentFolderId);
    set({ songsInView });
  }
}));
const HEADER_PATTERNS = [
  { re: /^(pre[-\s]?chorus|pre[-\s]?coro)\s*(\d*)/i, type: "pre-chorus", baseLabel: "Pre-Coro" },
  { re: /^(verse|verso)\s*(\d*)/i, type: "verse", baseLabel: "Verso" },
  { re: /^(chorus|coro)\s*(\d*)/i, type: "chorus", baseLabel: "Coro" },
  { re: /^(estribillo|refrain)\s*(\d*)/i, type: "estribillo", baseLabel: "Estribillo" },
  { re: /^(bridge|puente)\s*(\d*)/i, type: "bridge", baseLabel: "Puente" },
  { re: /^(intro)\s*(\d*)/i, type: "intro", baseLabel: "Intro" },
  { re: /^(outro|final|coda|ending)\s*(\d*)/i, type: "outro", baseLabel: "Outro" },
  { re: /^(tag|hook|gancho|vamp)\s*(\d*)/i, type: "custom", baseLabel: "Tag" }
];
function matchHeader(line) {
  const bracketed = /^\[.+\]$/.test(line.trim());
  const clean = line.replace(/^\[|\]$/g, "").replace(/:$/, "").trim();
  for (const { re, type, baseLabel } of HEADER_PATTERNS) {
    const m = clean.match(re);
    if (!m) continue;
    if (m[0].length !== clean.length && !bracketed) continue;
    return { type, baseLabel, num: m[2] ? Number(m[2]) : void 0 };
  }
  return null;
}
function blockKey(lines) {
  return lines.join("\n").toLowerCase().replace(/[^\w\náéíóúüñ\n]/g, " ").replace(/\s+/g, " ").trim();
}
function parseLyricsToSections(raw) {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return [];
  const rawBlocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const parsed = rawBlocks.map((block) => {
    const all = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const header = all.length ? matchHeader(all[0]) : null;
    return { header, lines: header ? all.slice(1) : all, raw: all };
  });
  const contentCount = /* @__PURE__ */ new Map();
  for (const b of parsed) {
    if (!b.header) {
      const k = blockKey(b.lines);
      contentCount.set(k, (contentCount.get(k) ?? 0) + 1);
    }
  }
  const typeCount = {};
  const seenRepeated = /* @__PURE__ */ new Map();
  const sections = [];
  for (const b of parsed) {
    if (!b.lines.length && !b.header) continue;
    if (b.header) {
      const { type, baseLabel, num } = b.header;
      typeCount[type] = (typeCount[type] ?? 0) + 1;
      const count = typeCount[type];
      const n = num ?? (count > 1 ? count : void 0);
      sections.push({
        type,
        label: n != null ? `${baseLabel} ${n}` : baseLabel,
        lines: b.lines
      });
    } else {
      const k = blockKey(b.lines);
      const occurrences = contentCount.get(k) ?? 1;
      const isRepeated = occurrences >= 2;
      if (isRepeated) {
        if (seenRepeated.has(k)) {
          sections.push({ type: "chorus", label: seenRepeated.get(k), lines: b.lines });
        } else {
          typeCount["chorus"] = (typeCount["chorus"] ?? 0) + 1;
          const count = typeCount["chorus"];
          const label = count > 1 ? `Coro ${count}` : "Coro";
          seenRepeated.set(k, label);
          sections.push({ type: "chorus", label, lines: b.lines });
        }
      } else {
        typeCount["verse"] = (typeCount["verse"] ?? 0) + 1;
        sections.push({ type: "verse", label: `Verso ${typeCount["verse"]}`, lines: b.lines });
      }
    }
  }
  return sections;
}
const SECTION_TYPE_LABEL = {
  verse: "Verso",
  chorus: "Coro",
  estribillo: "Estribillo",
  "pre-chorus": "Pre-Coro",
  bridge: "Puente",
  intro: "Intro",
  outro: "Outro",
  custom: "Personalizado"
};
const SECTION_COLOR = {
  verse: "bg-blue-900/40 border-blue-700",
  chorus: "bg-indigo-900/40 border-indigo-700",
  estribillo: "bg-violet-900/40 border-violet-700",
  "pre-chorus": "bg-cyan-900/40 border-cyan-700",
  bridge: "bg-purple-900/40 border-purple-700",
  intro: "bg-slate-700/40 border-slate-600",
  outro: "bg-slate-700/40 border-slate-600",
  custom: "bg-teal-900/40 border-teal-700"
};
function LyricsImportModal({ onApply, onClose }) {
  const [tab, setTab] = reactExports.useState("paste");
  const [pasteText, setPasteText] = reactExports.useState("");
  const [url, setUrl] = reactExports.useState("");
  const [urlLoading, setUrlLoading] = reactExports.useState(false);
  const [urlError, setUrlError] = reactExports.useState(null);
  const [preview, setPreview] = reactExports.useState(null);
  function handleParsePaste() {
    const sections = parseLyricsToSections(pasteText);
    setPreview(sections.length > 0 ? sections : null);
  }
  async function handleFetchUrl() {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    setPreview(null);
    const result = await window.api.fetchLyricsUrl(url.trim());
    if (!result.success || !result.rawText) {
      setUrlError(result.error ?? "Error desconocido");
      setUrlLoading(false);
      return;
    }
    const sections = parseLyricsToSections(result.rawText);
    if (sections.length === 0) {
      setUrlError('La letra se descargó pero no se pudo dividir en secciones. Prueba la pestaña "Pegar letra".');
    } else {
      setPreview(sections);
    }
    setUrlLoading(false);
  }
  function handleApply() {
    if (preview && preview.length > 0) onApply(preview);
  }
  const claudeApiKey = localStorage.getItem("claudeApiKey") ?? "";
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-700 shrink-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-bold", children: "Importar letra" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: onClose,
          className: "text-slate-400 hover:text-white transition-colors text-xl leading-none",
          children: "✕"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-1 px-6 pt-4 shrink-0", children: [
      ["paste", "Pegar letra"],
      ["url", "Importar URL"],
      ["ai", "Claude IA"]
    ].map(([t, label]) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => {
          setTab(t);
          setPreview(null);
          setUrlError(null);
        },
        className: `px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                ${tab === t ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`,
        children: [
          label,
          t === "ai" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1.5 text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md", children: "Próximamente" })
        ]
      },
      t
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4", children: [
      tab === "paste" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "Copia la letra desde cualquier sitio web y pégala aquí. El sistema detecta automáticamente versos, coros, puentes y más." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "textarea",
          {
            value: pasteText,
            onChange: (e) => {
              setPasteText(e.target.value);
              setPreview(null);
            },
            rows: 10,
            className: "w-full bg-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none border border-slate-700 font-mono",
            placeholder: `Ejemplo:

[Verso 1]
En la cruz
Donde todo fue consumado

[Coro]
Alabado seas
Por siempre alabado`
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: handleParsePaste,
            disabled: !pasteText.trim(),
            className: "self-start bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors",
            children: "Analizar letra"
          }
        )
      ] }),
      tab === "url" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-slate-400", children: [
          "Ingresa la URL de la página con la letra. Funciona mejor con",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-slate-300", children: "letras.com" }),
          ",",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-slate-300", children: "genius.com" }),
          " y",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-slate-300", children: "musica.com" }),
          ". Algunos sitios con carga dinámica pueden no funcionar."
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              value: url,
              onChange: (e) => {
                setUrl(e.target.value);
                setUrlError(null);
                setPreview(null);
              },
              onKeyDown: (e) => e.key === "Enter" && handleFetchUrl(),
              className: "flex-1 bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm",
              placeholder: "https://www.letras.com/...",
              type: "url"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: handleFetchUrl,
              disabled: !url.trim() || urlLoading,
              className: "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0",
              children: urlLoading ? "Descargando..." : "Importar"
            }
          )
        ] }),
        urlError && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-red-950/60 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm", children: urlError })
      ] }),
      tab === "ai" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-indigo-950/40 border border-indigo-800/50 rounded-2xl p-5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold text-indigo-200 mb-1", children: "Importar con Claude AI" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "Claude analiza cualquier URL o texto y extrae la letra dividiéndola inteligentemente en secciones etiquetadas, sin importar el formato de la página." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-sm text-slate-400 mb-1.5", children: "Clave API de Claude (Anthropic)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "password",
              defaultValue: claudeApiKey,
              readOnly: true,
              className: "w-full bg-slate-800/60 text-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 text-sm cursor-not-allowed",
              placeholder: claudeApiKey ? "••••••••••••••••" : "No configurada"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-slate-500 mt-1.5", children: [
            "Configura la clave en",
            " ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-indigo-400", children: "Ajustes → Importar con IA" }),
            "."
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-slate-800/60 rounded-2xl p-4 border border-slate-700 opacity-60", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400 mb-3", children: "URL o texto a procesar" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              disabled: true,
              className: "w-full bg-slate-900 text-slate-600 rounded-xl px-4 py-2.5 border border-slate-700 text-sm cursor-not-allowed",
              placeholder: "https://... (disponible próximamente)"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-slate-600 bg-slate-800/40 rounded-xl p-3 border border-slate-700/50", children: "Esta función estará disponible en una próxima actualización. Se requiere una clave de API de Anthropic (claude.ai)." })
      ] }),
      preview && preview.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-slate-700 pt-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-slate-400 mb-3", children: [
          "Vista previa — ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-white font-medium", children: [
            preview.length,
            " secciones detectadas"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-2 max-h-56 overflow-y-auto", children: preview.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: `rounded-xl px-3 py-2 border text-sm ${SECTION_COLOR[s.type] ?? "bg-slate-800 border-slate-700"}`,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-xs uppercase tracking-wider text-slate-300 mr-2", children: SECTION_TYPE_LABEL[s.type] ?? s.type }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-slate-400", children: s.label }),
              s.lines.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-slate-300 mt-1 text-xs truncate", children: [
                s.lines[0],
                s.lines.length > 1 && ` · ${s.lines[1]}`
              ] })
            ]
          },
          i
        )) })
      ] }),
      preview !== null && preview.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-yellow-950/40 border border-yellow-800/50 text-yellow-300 rounded-xl px-4 py-3 text-sm", children: "No se detectaron secciones. Revisa el formato del texto o añade encabezados como [Verso 1], [Coro], etc." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: onClose,
          className: "px-5 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors",
          children: "Cancelar"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: handleApply,
          disabled: !preview || preview.length === 0,
          className: "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors",
          children: [
            "Aplicar ",
            preview && preview.length > 0 ? `${preview.length} secciones` : ""
          ]
        }
      )
    ] })
  ] }) });
}
let initialized = false;
const useAudioStore = create((set, get) => ({
  engine: null,
  engineProgress: null,
  installing: false,
  byId: {},
  progress: {},
  init: () => {
    if (initialized) return;
    initialized = true;
    window.api.on("audio:progress", ({ songId, pct }) => set((s) => ({ progress: { ...s.progress, [songId]: pct } })));
    window.api.on("audio:status-changed", ({ songId, status, error }) => set((s) => s.byId[songId] ? { byId: { ...s.byId, [songId]: { ...s.byId[songId], status, error: error ?? null } } } : s));
    window.api.on("audio:engine-progress", (p) => set({ engineProgress: p }));
    void get().refreshEngine();
  },
  refreshEngine: async () => set({ engine: await window.api.audioEngineStatus() }),
  installEngine: async () => {
    set({ installing: true, engineProgress: null });
    const res = await window.api.audioInstallEngine();
    set({ installing: false });
    await get().refreshEngine();
    return res.ok ? null : res.error ?? "Error desconocido";
  },
  load: async (songId) => {
    const row = await window.api.audioGetSongAudio(songId);
    if (row) set((s) => ({ byId: { ...s.byId, [songId]: row } }));
    return row;
  },
  importTrack: async (songId, filePath) => {
    const row = await window.api.audioImportTrack(songId, filePath);
    set((s) => ({ byId: { ...s.byId, [songId]: row }, progress: { ...s.progress, [songId]: 0 } }));
  },
  reprocess: async (songId) => {
    const row = await window.api.audioReprocess(songId);
    set((s) => ({ byId: { ...s.byId, [songId]: row }, progress: { ...s.progress, [songId]: 0 } }));
  },
  cancel: async (songId) => window.api.audioCancel(songId),
  update: async (songId, patch) => {
    const row = await window.api.audioUpdate(songId, patch);
    set((s) => ({ byId: { ...s.byId, [songId]: row } }));
  }
}));
const STEMS = ["instrumental", "vocals"];
class StemPlayer {
  ctx = new AudioContext();
  gains;
  buffers = {};
  sources = [];
  startedAt = 0;
  offset = 0;
  playing = false;
  onEnded = null;
  constructor() {
    this.gains = {
      instrumental: this.ctx.createGain(),
      vocals: this.ctx.createGain()
    };
    STEMS.forEach((s) => this.gains[s].connect(this.ctx.destination));
  }
  /** Decodes without touching what is loaded, so a slow, superseded decode can simply be dropped. */
  async decode(data) {
    const [instrumental, vocals] = await Promise.all(STEMS.map((s) => this.ctx.decodeAudioData(data[s])));
    return { instrumental, vocals };
  }
  use(decoded) {
    this.stopSources();
    this.playing = false;
    this.offset = 0;
    this.buffers = { ...decoded };
  }
  get duration() {
    return this.buffers.instrumental?.duration ?? 0;
  }
  get currentTime() {
    if (!this.playing) return this.offset;
    return Math.max(0, Math.min(this.ctx.currentTime - this.startedAt, this.duration));
  }
  play() {
    if (this.playing || !this.buffers.instrumental) return;
    void this.ctx.resume();
    const when = this.ctx.currentTime + 0.05;
    this.sources = STEMS.map((s) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[s];
      src.connect(this.gains[s]);
      src.start(when, this.offset);
      return src;
    });
    const first = this.sources[0];
    first.onended = () => {
      if (this.sources[0] !== first || !this.playing) return;
      this.playing = false;
      this.offset = 0;
      this.sources = [];
      this.onEnded?.();
    };
    this.startedAt = when - this.offset;
    this.playing = true;
  }
  pause() {
    if (!this.playing) return;
    this.offset = this.currentTime;
    this.playing = false;
    this.stopSources();
  }
  seek(t) {
    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.playing = false;
      this.stopSources();
    }
    this.offset = Math.max(0, Math.min(t, this.duration));
    if (wasPlaying) this.play();
  }
  setVolume(stem, v) {
    this.gains[stem].gain.value = Math.max(0, Math.min(1, v));
  }
  dispose() {
    this.stopSources();
    void this.ctx.close();
  }
  stopSources() {
    this.sources.forEach((s) => {
      s.onended = null;
      try {
        s.stop();
      } catch {
      }
    });
    this.sources = [];
  }
}
const round = (t) => Math.round(t * 1e3) / 1e3;
function sectionsSignature(sections) {
  return `${sections.length}:${sections.map((s) => s.type).join(",")}`;
}
function cuesAreStale(cues, savedSig, sections) {
  if (cues.length === 0) return false;
  return savedSig !== sectionsSignature(sections);
}
function sortCues(cues) {
  return [...cues].sort((a, b) => a.time - b.time);
}
function cuePositionAt(cues, time, lead = 0) {
  let pos = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].time - lead <= time + 1e-9) pos = i;
    else break;
  }
  return pos;
}
function nudgeCue(cues, index, delta) {
  return sortCues(cues.map((c, i) => i === index ? { ...c, time: Math.max(0, round(c.time + delta)) } : c));
}
function removeCue(cues, index) {
  return cues.filter((_, i) => i !== index);
}
function upsertCueAt(cues, sectionIndex, time) {
  const matches = cues.filter((c) => c.sectionIndex === sectionIndex);
  if (matches.length === 1) {
    return sortCues(cues.map((c) => c === matches[0] ? { sectionIndex, time: round(time) } : c));
  }
  return sortCues([...cues, { sectionIndex, time: round(time) }]);
}
class CueRecorder {
  constructor(sectionCount) {
    this.sectionCount = sectionCount;
  }
  cues = [];
  next = 0;
  last = -1;
  get nextSection() {
    return this.next < this.sectionCount ? this.next : null;
  }
  get result() {
    return sortCues(this.cues);
  }
  tap(time) {
    if (this.next >= this.sectionCount) return null;
    return this.mark(this.next, time);
  }
  repeat(time) {
    if (this.last < 0) return null;
    const cue = { sectionIndex: this.last, time: round(time) };
    this.cues.push(cue);
    return cue;
  }
  mark(sectionIndex, time) {
    const cue = { sectionIndex, time: round(time) };
    this.cues.push(cue);
    this.last = sectionIndex;
    this.next = sectionIndex + 1;
    return cue;
  }
}
class CueFollower {
  constructor(cues, lead = 0) {
    this.lead = lead;
    this.cues = sortCues(cues);
  }
  cues;
  pos = -1;
  manual = false;
  get isManual() {
    return this.manual;
  }
  /** Returns the section to show when a new cue is crossed, else null. */
  update(time) {
    const pos = cuePositionAt(this.cues, time, this.lead);
    if (pos === this.pos) return null;
    this.pos = pos;
    if (pos < 0) return null;
    this.manual = false;
    return this.cues[pos].sectionIndex;
  }
  seek(time) {
    this.manual = false;
    this.pos = -2;
    return this.update(time);
  }
  markManual() {
    this.manual = true;
  }
  resumeAuto(time) {
    this.manual = false;
    this.pos = cuePositionAt(this.cues, time, this.lead);
    return this.pos < 0 ? null : this.cues[this.pos].sectionIndex;
  }
}
let player = null;
const getPlayer = () => player ??= new StemPlayer();
let follower = null;
const getFollower = () => follower;
function setFollowerCues(cues) {
  follower = cues && cues.length > 0 ? new CueFollower(cues, usePlaybackStore.getState().lead) : null;
}
const usePlaybackStore = create((set, get) => ({
  songId: null,
  status: "idle",
  error: null,
  playing: false,
  time: 0,
  duration: 0,
  volumes: { instrumental: 1, vocals: 0 },
  manual: false,
  recording: false,
  lead: 0.3,
  loadSong: async (songId) => {
    if (get().songId === songId && get().status === "ready") return;
    const p = getPlayer();
    p.pause();
    set({ songId, status: "loading", error: null, playing: false, time: 0, manual: false });
    try {
      const [instrumental, vocals, meta] = await Promise.all([
        window.api.audioReadStem(songId, "instrumental"),
        window.api.audioReadStem(songId, "vocals"),
        window.api.audioGetSongAudio(songId)
      ]);
      if (get().songId !== songId) return;
      const decoded = await p.decode({ instrumental: instrumental.slice().buffer, vocals: vocals.slice().buffer });
      if (get().songId !== songId) return;
      p.use(decoded);
      const volumes = { instrumental: meta?.vol_instrumental ?? 1, vocals: meta?.vol_vocals ?? 0 };
      p.setVolume("instrumental", volumes.instrumental);
      p.setVolume("vocals", volumes.vocals);
      p.onEnded = () => set({ playing: false, time: 0 });
      set({ status: "ready", duration: p.duration, volumes });
      if (meta && !meta.duration_sec) void window.api.audioUpdate(songId, { duration_sec: p.duration });
    } catch (e) {
      set({ status: "error", error: e.message });
    }
  },
  toggle: () => {
    const p = getPlayer();
    if (get().status !== "ready") return;
    if (p.playing) p.pause();
    else p.play();
    set({ playing: p.playing, time: p.currentTime });
  },
  seek: (t) => {
    getPlayer().seek(t);
    set({ time: getPlayer().currentTime });
  },
  setVolume: (stem, v) => {
    getPlayer().setVolume(stem, v);
    const volumes = { ...get().volumes, [stem]: v };
    set({ volumes });
    const id = get().songId;
    if (id) void window.api.audioUpdate(id, stem === "instrumental" ? { vol_instrumental: v } : { vol_vocals: v });
  },
  resumeAuto: () => set({ manual: false }),
  unload: () => {
    getPlayer().pause();
    follower = null;
    set({ songId: null, status: "idle", playing: false, time: 0, duration: 0, manual: false });
  },
  setRecording: (recording) => set({ recording })
}));
const useLiveStore = create((set, get) => ({
  isLive: false,
  currentSong: null,
  currentSectionIndex: 0,
  blackout: false,
  whiteout: false,
  setlist: [],
  startLive: async (setlist) => {
    await window.api.openLive();
    const song = setlist[0];
    if (song) {
      await window.api.setVideo({ videoPath: song.video_path ?? null });
      await sendSection(song, 0);
    }
    set({ isLive: true, setlist, currentSong: song ?? null, currentSectionIndex: 0 });
  },
  stopLive: async () => {
    await window.api.closeLive();
    set({ isLive: false, currentSong: null, blackout: false, whiteout: false });
  },
  goToSection: async (index) => {
    const { currentSong } = get();
    if (!currentSong) return;
    await sendSection(currentSong, index);
    set({ currentSectionIndex: index });
  },
  nextSection: async () => {
    const { currentSong, currentSectionIndex } = get();
    if (!currentSong) return;
    const next = currentSectionIndex + 1;
    if (next < currentSong.sections.length) {
      await sendSection(currentSong, next);
      set({ currentSectionIndex: next });
    }
  },
  prevSection: async () => {
    const { currentSong, currentSectionIndex } = get();
    if (!currentSong) return;
    const prev = currentSectionIndex - 1;
    if (prev >= 0) {
      await sendSection(currentSong, prev);
      set({ currentSectionIndex: prev });
    }
  },
  toggleBlackout: async () => {
    const active = !get().blackout;
    await window.api.setBlackout(active);
    set({ blackout: active });
  },
  toggleWhiteout: async () => {
    const active = !get().whiteout;
    await window.api.setWhiteout(active);
    set({ whiteout: active });
  },
  changeSong: async (song) => {
    await window.api.setVideo({ videoPath: song.video_path ?? null });
    await sendSection(song, 0);
    set({ currentSong: song, currentSectionIndex: 0 });
  }
}));
async function sendSection(song, index) {
  const section = song.sections[index];
  if (!section) return;
  await window.api.showSection({
    songId: song.id,
    sectionIndex: index,
    text: section.lines.join("\n"),
    lines: section.lines,
    textStyle: song.text_style
  });
}
const fmt$1 = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
function AudioTransport() {
  const { status, playing, time, duration, volumes, manual, toggle, seek, setVolume, resumeAuto } = usePlaybackStore();
  if (status === "idle") return null;
  if (status === "loading") return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-slate-400", children: "Cargando audio…" });
  if (status === "error") return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-red-400", children: "No se pudo cargar el audio" });
  function onSeek(t) {
    seek(t);
    if (usePlaybackStore.getState().recording) return;
    const idx = getFollower()?.seek(t);
    if (idx !== null && idx !== void 0) void useLiveStore.getState().goToSection(idx);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 bg-slate-900 rounded-xl px-3 py-2 border border-slate-800", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: toggle,
        title: playing ? "Pausar" : "Reproducir",
        className: "w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm shrink-0",
        children: playing ? "❚❚" : "▶"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-slate-400 tabular-nums w-20", children: [
      fmt$1(time),
      " / ",
      fmt$1(duration)
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        type: "range",
        min: 0,
        max: duration || 0,
        step: 0.1,
        value: time,
        "aria-label": "Posición",
        onChange: (e) => onSeek(Number(e.target.value)),
        className: "w-40 accent-indigo-500"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Vol, { label: "Inst.", value: volumes.instrumental, onChange: (v) => setVolume("instrumental", v) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Vol, { label: "Voz", value: volumes.vocals, onChange: (v) => setVolume("vocals", v) }),
    getFollower() && (manual ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: resumeAuto, className: "text-xs px-2 py-1 rounded-lg bg-amber-600 text-white", children: "Manual · volver a auto" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs px-2 py-1 rounded-lg bg-emerald-700 text-white", children: "Automático" }))
  ] });
}
function Vol({ label, value, onChange }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex items-center gap-1.5 text-xs text-slate-400", children: [
    label,
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        value,
        onChange: (e) => onChange(Number(e.target.value)),
        className: "w-20 accent-indigo-500"
      }
    )
  ] });
}
function StemMixer({ songId }) {
  const { songId: loaded, loadSong, unload } = usePlaybackStore();
  const isLive = useLiveStore((s) => s.isLive);
  reactExports.useEffect(() => () => {
    if (!useLiveStore.getState().isLive) unload();
  }, []);
  if (isLive) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "Hay un servicio en vivo. Termínalo para escuchar o marcar cues aquí." });
  }
  if (loaded !== songId) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: () => loadSong(songId), children: "Escuchar / mezclar" }) });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AudioTransport, {});
}
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
function CueEditor({ songId, sections }) {
  const audio = useAudioStore((s) => s.byId[songId]);
  const update = useAudioStore((s) => s.update);
  const { songId: loaded, recording, setRecording, seek, toggle } = usePlaybackStore();
  const isLive = useLiveStore((s) => s.isLive);
  const recorder = reactExports.useRef(null);
  const [draft, setDraft] = reactExports.useState([]);
  const [selected, setSelected] = reactExports.useState(0);
  const cues = recording ? draft : audio?.cues ?? [];
  const stale = audio ? cuesAreStale(audio.cues, audio.cues_sections_sig, sections) : false;
  const save = (next2) => update(songId, { cues: next2, cues_sections_sig: sectionsSignature(sections) });
  reactExports.useEffect(() => {
    if (!recording) return;
    function onKey(e) {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const t = getPlayer().currentTime;
      if (e.key === " ") {
        e.preventDefault();
        document.activeElement?.blur();
        recorder.current?.tap(t);
      } else if (e.key === "r" || e.key === "R") recorder.current?.repeat(t);
      else return;
      setDraft(recorder.current.result);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording]);
  reactExports.useEffect(() => () => {
    if (usePlaybackStore.getState().recording) setRecording(false);
  }, []);
  if (isLive || loaded !== songId || sections.length === 0) return null;
  function start() {
    recorder.current = new CueRecorder(sections.length);
    setDraft([]);
    setRecording(true);
    seek(0);
    if (!getPlayer().playing) toggle();
  }
  async function finish() {
    if (getPlayer().playing) toggle();
    setRecording(false);
    await save(recorder.current?.result ?? []);
    recorder.current = null;
  }
  function markSection(i) {
    if (!recording || !recorder.current) return;
    recorder.current.mark(i, getPlayer().currentTime);
    setDraft(recorder.current.result);
  }
  const next = recorder.current?.nextSection ?? null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 border-t border-slate-700 pt-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { className: "text-sm font-semibold flex-1", children: [
        "Cues (",
        cues.length,
        ")"
      ] }),
      !recording && /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: start, children: cues.length ? "Volver a marcar" : "Marcar cues" }),
      recording && /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: finish, children: "Terminar y guardar" })
    ] }),
    stale && !recording && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-amber-400 mb-3", children: "Las secciones cambiaron después de marcar los cues. No se usarán en vivo hasta que los vuelvas a marcar." }),
    recording && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-slate-300 mb-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "Espacio" }),
      ": siguiente sección",
      next !== null ? ` (${sections[next].label})` : " (no quedan)",
      " ·",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: " R" }),
      ": repetir la actual · ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "clic" }),
      " en una sección: marcarla ahora"
    ] }),
    recording && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-1 flex-wrap mb-3", children: sections.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: () => markSection(i),
        className: `px-2.5 py-1 rounded-lg text-xs border ${i === next ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-700 border-slate-600 text-slate-300"}`,
        children: s.label
      },
      i
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ol", { className: "flex flex-col gap-1", children: cues.map((c, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "li",
      {
        className: `flex items-center gap-2 text-sm rounded-lg px-2 py-1 ${i === selected && !recording ? "bg-slate-700" : ""}`,
        onClick: () => setSelected(i),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tabular-nums text-slate-400 w-16", children: fmt(c.time) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1", children: sections[c.sectionIndex]?.label ?? `Sección ${c.sectionIndex + 1}` }),
          !recording && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(SmallBtn, { onClick: () => save(nudgeCue(cues, i, -0.1)), children: "−0.1" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SmallBtn, { onClick: () => save(nudgeCue(cues, i, 0.1)), children: "+0.1" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SmallBtn, { onClick: () => {
              seek(Math.max(0, c.time - 2));
              if (!getPlayer().playing) toggle();
            }, children: "▶" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SmallBtn, { onClick: () => save(upsertCueAt(cues, c.sectionIndex, getPlayer().currentTime)), children: "Marcar aquí" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SmallBtn, { onClick: () => save(removeCue(cues, i)), children: "✕" })
          ] })
        ]
      },
      `${c.sectionIndex}-${c.time}-${i}`
    )) })
  ] });
}
function SmallBtn({ onClick, children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
      className: "text-xs px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600",
      children
    }
  );
}
const useDialogStore = create((set, get) => ({
  current: null,
  queue: [],
  answer: (value) => {
    const { current, queue } = get();
    if (!current) return;
    const [next = null, ...rest] = queue;
    set({ current: next, queue: rest });
    current.resolve(value);
  }
}));
function ask(request) {
  return new Promise((resolve) => {
    const pending = { ...request, resolve };
    const { current, queue } = useDialogStore.getState();
    if (current) useDialogStore.setState({ queue: [...queue, pending] });
    else useDialogStore.setState({ current: pending });
  });
}
async function confirmDialog(message, opts = {}) {
  const value = await ask({
    title: opts.title ?? "Confirmar",
    message,
    actions: [
      { label: "Cancelar", value: "cancel", variant: "neutral" },
      { label: opts.confirmLabel ?? "Aceptar", value: "confirm", variant: opts.danger ? "danger" : "primary" }
    ]
  });
  return value === "confirm";
}
async function alertDialog(message, title = "Aviso") {
  await ask({ title, message, actions: [{ label: "Entendido", value: "ok", variant: "primary" }] });
}
const STEP_LABEL = { download: "Descargando", extract: "Extrayendo", pip: "Instalando librerías", ffmpeg: "Preparando ffmpeg", selftest: "Probando el motor" };
const gb = (b) => (b / 1024 ** 3).toFixed(1);
function AudioPanel({ songId, sections }) {
  const { engine, engineProgress, installing, byId, progress, init, installEngine, load, importTrack, reprocess, cancel } = useAudioStore();
  const [error, setError] = reactExports.useState(null);
  const audio = songId ? byId[songId] : void 0;
  reactExports.useEffect(() => {
    init();
  }, []);
  reactExports.useEffect(() => {
    if (songId) void load(songId);
  }, [songId]);
  if (!songId) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Box, { children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "Guarda la canción primero para poder agregarle audio." }) });
  }
  async function pickAndImport() {
    setError(null);
    const file = await window.api.openFileDialog([{ name: "Audio", extensions: ["mp3", "wav", "flac", "m4a"] }]);
    if (!file) return;
    try {
      await importTrack(songId, file);
    } catch (e) {
      setError(e.message);
    }
  }
  async function install() {
    setError(null);
    const err = await installEngine();
    if (err) setError(err);
  }
  const needsEngine = engine && !engine.installed;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Box, { children: [
    error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-red-400 mb-3", children: error }),
    needsEngine && !engine.platformSupported && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-amber-400", children: "Esta computadora no es compatible con el motor de separación." }),
    needsEngine && engine.platformSupported && !installing && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-slate-300 flex-1", children: [
        "Para separar la voz hay que preparar el motor de audio una sola vez (~",
        gb(engine.estimatedInstallBytes),
        " GB de descarga y espacio en disco)."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: install, children: "Preparar motor de audio" })
    ] }),
    installing && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Progress, { pct: engineProgress?.pct ?? 0, label: engineProgress ? STEP_LABEL[engineProgress.step] : "Iniciando" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: () => window.api.audioCancelInstall(), children: "Cancelar" })
    ] }),
    engine?.installed && !audio && /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: pickAndImport, children: "Importar pista" }),
    audio && (audio.status === "pending" || audio.status === "processing") && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Progress, { pct: progress[songId] ?? 0, label: audio.status === "pending" ? "En espera" : "Separando voz e instrumental (tarda ≈2–3× la duración de la canción)" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: () => cancel(songId), children: "Cancelar" })
    ] }),
    audio && (audio.status === "failed" || audio.status === "cancelled") && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-red-400 flex-1", children: audio.status === "cancelled" ? "Separación cancelada." : `Falló la separación: ${audio.error ?? ""}` }),
      engine?.installed && /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: () => reprocess(songId), children: "Reintentar" }),
      engine?.installed && /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: pickAndImport, children: "Otra pista" })
    ] }),
    audio?.status === "ready" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-emerald-400 flex-1", children: "Pista lista: instrumental y voz separadas." }),
        engine?.installed && /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: pickAndImport, children: "Reemplazar pista" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StemMixer, { songId }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CueEditor, { songId, sections }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Btn, { onClick: async () => {
        const ok = await confirmDialog(
          "Compartir el audio de canciones comerciales puede requerir licencia (por ejemplo CCLI o equivalente). Es responsabilidad de tu iglesia contar con ella. ¿Exportar el paquete?",
          { title: "Exportar paquete", confirmLabel: "Exportar" }
        );
        if (!ok) return;
        try {
          await window.api.packExport(songId);
          setError(null);
        } catch (e) {
          setError(e.message);
        }
      }, children: "Exportar paquete (.wfpack)" }) })
    ] })
  ] });
}
function Box({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-5 bg-slate-800 rounded-2xl p-4 border border-slate-700", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-xs font-semibold text-slate-400 mb-4 uppercase tracking-widest", children: "Audio" }),
    children
  ] });
}
function Btn({ onClick, children, disabled }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      onClick,
      disabled,
      className: "bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm transition-colors border border-slate-600 shrink-0",
      children
    }
  );
}
function Progress({ pct, label }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between text-xs text-slate-400 mb-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: label }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        pct,
        "%"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 bg-slate-700 rounded-full overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full bg-indigo-500 transition-all", style: { width: `${pct}%` } }) })
  ] });
}
const MEDIA_SCHEME = "alado-media";
function mediaUrl(path) {
  return `${MEDIA_SCHEME}://video/${encodeURIComponent(path)}`;
}
const STAGE_W = 1920;
const STAGE_H = 1080;
function SongPreview({ sections, selected, onSelect, textStyle, videoPath }) {
  const frameRef = reactExports.useRef(null);
  const [scale, setScale] = reactExports.useState(0);
  reactExports.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / STAGE_W));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const index = Math.min(selected, sections.length - 1);
  const section = index >= 0 ? sections[index] : void 0;
  const lines = (section?.lines ?? []).filter((l) => l.trim() !== "");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-slate-800 rounded-2xl p-3 border border-slate-700", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-xs font-semibold text-slate-400 uppercase tracking-widest flex-1", children: "Vista previa" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => onSelect(index - 1),
          disabled: index <= 0,
          className: "w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm",
          title: "Sección anterior",
          children: "◀"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-slate-400 tabular-nums w-14 text-center", children: sections.length ? `${index + 1} / ${sections.length}` : "—" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => onSelect(index + 1),
          disabled: index >= sections.length - 1,
          className: "w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm",
          title: "Sección siguiente",
          children: "▶"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: frameRef, className: "relative w-full aspect-video rounded-xl overflow-hidden bg-black", children: [
      scale > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: STAGE_W,
        height: STAGE_H,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        overflow: "hidden"
      }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(SlideView, { lines, textStyle, videoSrc: videoPath ? mediaUrl(videoPath) : null }) }),
      !section && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "absolute inset-0 flex items-center justify-center text-sm text-slate-500", children: "Sin secciones" })
    ] }),
    section && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-400 mt-2 truncate", children: section.label })
  ] });
}
function arrayMove(array, from, to) {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}
function getSortedRects(items, rects) {
  return items.reduce((accumulator, id, index) => {
    const rect = rects.get(id);
    if (rect) {
      accumulator[index] = rect;
    }
    return accumulator;
  }, Array(items.length));
}
function isValidIndex(index) {
  return index !== null && index >= 0;
}
function itemsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
function normalizeDisabled(disabled) {
  if (typeof disabled === "boolean") {
    return {
      draggable: disabled,
      droppable: disabled
    };
  }
  return disabled;
}
const rectSortingStrategy = (_ref) => {
  let {
    rects,
    activeIndex,
    overIndex,
    index
  } = _ref;
  const newRects = arrayMove(rects, overIndex, activeIndex);
  const oldRect = rects[index];
  const newRect = newRects[index];
  if (!newRect || !oldRect) {
    return null;
  }
  return {
    x: newRect.left - oldRect.left,
    y: newRect.top - oldRect.top,
    scaleX: newRect.width / oldRect.width,
    scaleY: newRect.height / oldRect.height
  };
};
const defaultScale$1 = {
  scaleX: 1,
  scaleY: 1
};
const verticalListSortingStrategy = (_ref) => {
  var _rects$activeIndex;
  let {
    activeIndex,
    activeNodeRect: fallbackActiveRect,
    index,
    rects,
    overIndex
  } = _ref;
  const activeNodeRect = (_rects$activeIndex = rects[activeIndex]) != null ? _rects$activeIndex : fallbackActiveRect;
  if (!activeNodeRect) {
    return null;
  }
  if (index === activeIndex) {
    const overIndexRect = rects[overIndex];
    if (!overIndexRect) {
      return null;
    }
    return {
      x: 0,
      y: activeIndex < overIndex ? overIndexRect.top + overIndexRect.height - (activeNodeRect.top + activeNodeRect.height) : overIndexRect.top - activeNodeRect.top,
      ...defaultScale$1
    };
  }
  const itemGap = getItemGap$1(rects, index, activeIndex);
  if (index > activeIndex && index <= overIndex) {
    return {
      x: 0,
      y: -activeNodeRect.height - itemGap,
      ...defaultScale$1
    };
  }
  if (index < activeIndex && index >= overIndex) {
    return {
      x: 0,
      y: activeNodeRect.height + itemGap,
      ...defaultScale$1
    };
  }
  return {
    x: 0,
    y: 0,
    ...defaultScale$1
  };
};
function getItemGap$1(clientRects, index, activeIndex) {
  const currentRect = clientRects[index];
  const previousRect = clientRects[index - 1];
  const nextRect = clientRects[index + 1];
  if (!currentRect) {
    return 0;
  }
  if (activeIndex < index) {
    return previousRect ? currentRect.top - (previousRect.top + previousRect.height) : nextRect ? nextRect.top - (currentRect.top + currentRect.height) : 0;
  }
  return nextRect ? nextRect.top - (currentRect.top + currentRect.height) : previousRect ? currentRect.top - (previousRect.top + previousRect.height) : 0;
}
const ID_PREFIX = "Sortable";
const Context = /* @__PURE__ */ React.createContext({
  activeIndex: -1,
  containerId: ID_PREFIX,
  disableTransforms: false,
  items: [],
  overIndex: -1,
  useDragOverlay: false,
  sortedRects: [],
  strategy: rectSortingStrategy,
  disabled: {
    draggable: false,
    droppable: false
  }
});
function SortableContext(_ref) {
  let {
    children,
    id,
    items: userDefinedItems,
    strategy = rectSortingStrategy,
    disabled: disabledProp = false
  } = _ref;
  const {
    active,
    dragOverlay,
    droppableRects,
    over,
    measureDroppableContainers
  } = useDndContext();
  const containerId = useUniqueId(ID_PREFIX, id);
  const useDragOverlay = Boolean(dragOverlay.rect !== null);
  const items = reactExports.useMemo(() => userDefinedItems.map((item) => typeof item === "object" && "id" in item ? item.id : item), [userDefinedItems]);
  const isDragging = active != null;
  const activeIndex = active ? items.indexOf(active.id) : -1;
  const overIndex = over ? items.indexOf(over.id) : -1;
  const previousItemsRef = reactExports.useRef(items);
  const itemsHaveChanged = !itemsEqual(items, previousItemsRef.current);
  const disableTransforms = overIndex !== -1 && activeIndex === -1 || itemsHaveChanged;
  const disabled = normalizeDisabled(disabledProp);
  useIsomorphicLayoutEffect(() => {
    if (itemsHaveChanged && isDragging) {
      measureDroppableContainers(items);
    }
  }, [itemsHaveChanged, items, isDragging, measureDroppableContainers]);
  reactExports.useEffect(() => {
    previousItemsRef.current = items;
  }, [items]);
  const contextValue = reactExports.useMemo(
    () => ({
      activeIndex,
      containerId,
      disabled,
      disableTransforms,
      items,
      overIndex,
      useDragOverlay,
      sortedRects: getSortedRects(items, droppableRects),
      strategy
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeIndex, containerId, disabled.draggable, disabled.droppable, disableTransforms, items, overIndex, droppableRects, useDragOverlay, strategy]
  );
  return React.createElement(Context.Provider, {
    value: contextValue
  }, children);
}
const defaultNewIndexGetter = (_ref) => {
  let {
    id,
    items,
    activeIndex,
    overIndex
  } = _ref;
  return arrayMove(items, activeIndex, overIndex).indexOf(id);
};
const defaultAnimateLayoutChanges = (_ref2) => {
  let {
    containerId,
    isSorting,
    wasDragging,
    index,
    items,
    newIndex,
    previousItems,
    previousContainerId,
    transition
  } = _ref2;
  if (!transition || !wasDragging) {
    return false;
  }
  if (previousItems !== items && index === newIndex) {
    return false;
  }
  if (isSorting) {
    return true;
  }
  return newIndex !== index && containerId === previousContainerId;
};
const defaultTransition = {
  duration: 200,
  easing: "ease"
};
const transitionProperty = "transform";
const disabledTransition = /* @__PURE__ */ CSS.Transition.toString({
  property: transitionProperty,
  duration: 0,
  easing: "linear"
});
const defaultAttributes = {
  roleDescription: "sortable"
};
function useDerivedTransform(_ref) {
  let {
    disabled,
    index,
    node,
    rect
  } = _ref;
  const [derivedTransform, setDerivedtransform] = reactExports.useState(null);
  const previousIndex = reactExports.useRef(index);
  useIsomorphicLayoutEffect(() => {
    if (!disabled && index !== previousIndex.current && node.current) {
      const initial = rect.current;
      if (initial) {
        const current = getClientRect(node.current, {
          ignoreTransform: true
        });
        const delta = {
          x: initial.left - current.left,
          y: initial.top - current.top,
          scaleX: initial.width / current.width,
          scaleY: initial.height / current.height
        };
        if (delta.x || delta.y) {
          setDerivedtransform(delta);
        }
      }
    }
    if (index !== previousIndex.current) {
      previousIndex.current = index;
    }
  }, [disabled, index, node, rect]);
  reactExports.useEffect(() => {
    if (derivedTransform) {
      setDerivedtransform(null);
    }
  }, [derivedTransform]);
  return derivedTransform;
}
function useSortable(_ref) {
  let {
    animateLayoutChanges = defaultAnimateLayoutChanges,
    attributes: userDefinedAttributes,
    disabled: localDisabled,
    data: customData,
    getNewIndex = defaultNewIndexGetter,
    id,
    strategy: localStrategy,
    resizeObserverConfig,
    transition = defaultTransition
  } = _ref;
  const {
    items,
    containerId,
    activeIndex,
    disabled: globalDisabled,
    disableTransforms,
    sortedRects,
    overIndex,
    useDragOverlay,
    strategy: globalStrategy
  } = reactExports.useContext(Context);
  const disabled = normalizeLocalDisabled(localDisabled, globalDisabled);
  const index = items.indexOf(id);
  const data = reactExports.useMemo(() => ({
    sortable: {
      containerId,
      index,
      items
    },
    ...customData
  }), [containerId, customData, index, items]);
  const itemsAfterCurrentSortable = reactExports.useMemo(() => items.slice(items.indexOf(id)), [items, id]);
  const {
    rect,
    node,
    isOver,
    setNodeRef: setDroppableNodeRef
  } = useDroppable({
    id,
    data,
    disabled: disabled.droppable,
    resizeObserverConfig: {
      updateMeasurementsFor: itemsAfterCurrentSortable,
      ...resizeObserverConfig
    }
  });
  const {
    active,
    activatorEvent,
    activeNodeRect,
    attributes,
    setNodeRef: setDraggableNodeRef,
    listeners,
    isDragging,
    over,
    setActivatorNodeRef,
    transform
  } = useDraggable({
    id,
    data,
    attributes: {
      ...defaultAttributes,
      ...userDefinedAttributes
    },
    disabled: disabled.draggable
  });
  const setNodeRef = useCombinedRefs(setDroppableNodeRef, setDraggableNodeRef);
  const isSorting = Boolean(active);
  const displaceItem = isSorting && !disableTransforms && isValidIndex(activeIndex) && isValidIndex(overIndex);
  const shouldDisplaceDragSource = !useDragOverlay && isDragging;
  const dragSourceDisplacement = shouldDisplaceDragSource && displaceItem ? transform : null;
  const strategy = localStrategy != null ? localStrategy : globalStrategy;
  const finalTransform = displaceItem ? dragSourceDisplacement != null ? dragSourceDisplacement : strategy({
    rects: sortedRects,
    activeNodeRect,
    activeIndex,
    overIndex,
    index
  }) : null;
  const newIndex = isValidIndex(activeIndex) && isValidIndex(overIndex) ? getNewIndex({
    id,
    items,
    activeIndex,
    overIndex
  }) : index;
  const activeId = active == null ? void 0 : active.id;
  const previous = reactExports.useRef({
    activeId,
    items,
    newIndex,
    containerId
  });
  const itemsHaveChanged = items !== previous.current.items;
  const shouldAnimateLayoutChanges = animateLayoutChanges({
    active,
    containerId,
    isDragging,
    isSorting,
    id,
    index,
    items,
    newIndex: previous.current.newIndex,
    previousItems: previous.current.items,
    previousContainerId: previous.current.containerId,
    transition,
    wasDragging: previous.current.activeId != null
  });
  const derivedTransform = useDerivedTransform({
    disabled: !shouldAnimateLayoutChanges,
    index,
    node,
    rect
  });
  reactExports.useEffect(() => {
    if (isSorting && previous.current.newIndex !== newIndex) {
      previous.current.newIndex = newIndex;
    }
    if (containerId !== previous.current.containerId) {
      previous.current.containerId = containerId;
    }
    if (items !== previous.current.items) {
      previous.current.items = items;
    }
  }, [isSorting, newIndex, containerId, items]);
  reactExports.useEffect(() => {
    if (activeId === previous.current.activeId) {
      return;
    }
    if (activeId && !previous.current.activeId) {
      previous.current.activeId = activeId;
      return;
    }
    const timeoutId = setTimeout(() => {
      previous.current.activeId = activeId;
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [activeId]);
  return {
    active,
    activeIndex,
    attributes,
    data,
    rect,
    index,
    newIndex,
    items,
    isOver,
    isSorting,
    isDragging,
    listeners,
    node,
    overIndex,
    over,
    setNodeRef,
    setActivatorNodeRef,
    setDroppableNodeRef,
    setDraggableNodeRef,
    transform: derivedTransform != null ? derivedTransform : finalTransform,
    transition: getTransition()
  };
  function getTransition() {
    if (
      // Temporarily disable transitions for a single frame to set up derived transforms
      derivedTransform || // Or to prevent items jumping to back to their "new" position when items change
      itemsHaveChanged && previous.current.newIndex === index
    ) {
      return disabledTransition;
    }
    if (shouldDisplaceDragSource && !isKeyboardEvent(activatorEvent) || !transition) {
      return void 0;
    }
    if (isSorting || shouldAnimateLayoutChanges) {
      return CSS.Transition.toString({
        ...transition,
        property: transitionProperty
      });
    }
    return void 0;
  }
}
function normalizeLocalDisabled(localDisabled, globalDisabled) {
  var _localDisabled$dragga, _localDisabled$droppa;
  if (typeof localDisabled === "boolean") {
    return {
      draggable: localDisabled,
      // Backwards compatibility
      droppable: false
    };
  }
  return {
    draggable: (_localDisabled$dragga = localDisabled == null ? void 0 : localDisabled.draggable) != null ? _localDisabled$dragga : globalDisabled.draggable,
    droppable: (_localDisabled$droppa = localDisabled == null ? void 0 : localDisabled.droppable) != null ? _localDisabled$droppa : globalDisabled.droppable
  };
}
function hasSortableData(entry) {
  if (!entry) {
    return false;
  }
  const data = entry.data.current;
  if (data && "sortable" in data && typeof data.sortable === "object" && "containerId" in data.sortable && "items" in data.sortable && "index" in data.sortable) {
    return true;
  }
  return false;
}
const directions = [KeyboardCode.Down, KeyboardCode.Right, KeyboardCode.Up, KeyboardCode.Left];
const sortableKeyboardCoordinates = (event, _ref) => {
  let {
    context: {
      active,
      collisionRect,
      droppableRects,
      droppableContainers,
      over,
      scrollableAncestors
    }
  } = _ref;
  if (directions.includes(event.code)) {
    event.preventDefault();
    if (!active || !collisionRect) {
      return;
    }
    const filteredContainers = [];
    droppableContainers.getEnabled().forEach((entry) => {
      if (!entry || entry != null && entry.disabled) {
        return;
      }
      const rect = droppableRects.get(entry.id);
      if (!rect) {
        return;
      }
      switch (event.code) {
        case KeyboardCode.Down:
          if (collisionRect.top < rect.top) {
            filteredContainers.push(entry);
          }
          break;
        case KeyboardCode.Up:
          if (collisionRect.top > rect.top) {
            filteredContainers.push(entry);
          }
          break;
        case KeyboardCode.Left:
          if (collisionRect.left > rect.left) {
            filteredContainers.push(entry);
          }
          break;
        case KeyboardCode.Right:
          if (collisionRect.left < rect.left) {
            filteredContainers.push(entry);
          }
          break;
      }
    });
    const collisions = closestCorners({
      collisionRect,
      droppableRects,
      droppableContainers: filteredContainers
    });
    let closestId = getFirstCollision(collisions, "id");
    if (closestId === (over == null ? void 0 : over.id) && collisions.length > 1) {
      closestId = collisions[1].id;
    }
    if (closestId != null) {
      const activeDroppable = droppableContainers.get(active.id);
      const newDroppable = droppableContainers.get(closestId);
      const newRect = newDroppable ? droppableRects.get(newDroppable.id) : null;
      const newNode = newDroppable == null ? void 0 : newDroppable.node.current;
      if (newNode && newRect && activeDroppable && newDroppable) {
        const newScrollAncestors = getScrollableAncestors(newNode);
        const hasDifferentScrollAncestors = newScrollAncestors.some((element, index) => scrollableAncestors[index] !== element);
        const hasSameContainer = isSameContainer(activeDroppable, newDroppable);
        const isAfterActive = isAfter(activeDroppable, newDroppable);
        const offset = hasDifferentScrollAncestors || !hasSameContainer ? {
          x: 0,
          y: 0
        } : {
          x: isAfterActive ? collisionRect.width - newRect.width : 0,
          y: isAfterActive ? collisionRect.height - newRect.height : 0
        };
        const rectCoordinates = {
          x: newRect.left,
          y: newRect.top
        };
        const newCoordinates = offset.x && offset.y ? rectCoordinates : subtract(rectCoordinates, offset);
        return newCoordinates;
      }
    }
  }
  return void 0;
};
function isSameContainer(a, b) {
  if (!hasSortableData(a) || !hasSortableData(b)) {
    return false;
  }
  return a.data.current.sortable.containerId === b.data.current.sortable.containerId;
}
function isAfter(a, b) {
  if (!hasSortableData(a) || !hasSortableData(b)) {
    return false;
  }
  if (!isSameContainer(a, b)) {
    return false;
  }
  return a.data.current.sortable.index < b.data.current.sortable.index;
}
const SECTION_TYPES = [
  { value: "verse", label: "Verso" },
  { value: "chorus", label: "Coro" },
  { value: "estribillo", label: "Estribillo" },
  { value: "pre-chorus", label: "Pre-Coro" },
  { value: "bridge", label: "Puente" },
  { value: "intro", label: "Intro" },
  { value: "outro", label: "Outro" },
  { value: "custom", label: "Personalizado" }
];
const SECTION_BORDER = {
  verse: "border-l-blue-500",
  chorus: "border-l-indigo-500",
  estribillo: "border-l-violet-500",
  "pre-chorus": "border-l-cyan-500",
  bridge: "border-l-purple-500",
  intro: "border-l-slate-400",
  outro: "border-l-slate-400",
  custom: "border-l-teal-500"
};
function SortableSectionCard({ id, section, index, previewing, onPreview, onUpdate, onUpdateLines, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      onFocusCapture: () => onPreview(index),
      onClick: () => onPreview(index),
      className: `bg-slate-800 rounded-2xl p-4 border border-l-4 ${SECTION_BORDER[section.type] ?? "border-l-slate-500"}
        ${previewing ? "border-indigo-400 ring-1 ring-indigo-400/40" : "border-slate-700"}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 mb-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              ...attributes,
              ...listeners,
              className: "text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing text-lg select-none flex items-center",
              title: "Arrastrar para reordenar",
              children: "⠿"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "select",
            {
              value: section.type,
              onChange: (e) => {
                const newType = e.target.value;
                const baseLabel = SECTION_TYPES.find((t) => t.value === newType)?.label ?? newType;
                onUpdate(index, { type: newType, label: baseLabel });
              },
              className: "bg-slate-700 text-white rounded-lg px-3 py-2 outline-none border border-slate-600",
              children: SECTION_TYPES.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: t.value, children: t.label }, t.value))
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              value: section.label,
              onChange: (e) => onUpdate(index, { label: e.target.value }),
              className: "flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600",
              placeholder: "Etiqueta"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => onRemove(index),
              className: "text-slate-500 hover:text-red-400 px-2 transition-colors",
              title: "Eliminar sección",
              children: "✕"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "textarea",
          {
            value: section.lines.join("\n"),
            onChange: (e) => onUpdateLines(index, e.target.value),
            rows: 4,
            className: "w-full bg-slate-900 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none border border-slate-700",
            placeholder: "Escribe la letra aquí, una línea por renglón..."
          }
        )
      ]
    }
  );
}
function SongEditor({ song, onClose }) {
  const { saveSong } = useSongsStore();
  const [title, setTitle] = reactExports.useState(song.title);
  const [artist, setArtist] = reactExports.useState(song.artist ?? "");
  const [sections, setSections] = reactExports.useState(song.sections);
  const [videoPath, setVideoPath] = reactExports.useState(song.video_path ?? "");
  const [textStyle, setTextStyle] = reactExports.useState(song.text_style ?? {});
  const [saving, setSaving] = reactExports.useState(false);
  const [showImport, setShowImport] = reactExports.useState(false);
  const [previewIndex, setPreviewIndex] = reactExports.useState(0);
  function updateTextStyle(patch) {
    setTextStyle((prev) => ({ ...prev, ...patch }));
  }
  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await saveSong({
      ...song,
      title: title.trim(),
      artist: artist.trim() || void 0,
      sections,
      video_path: videoPath || void 0,
      text_style: textStyle
    });
    setSaving(false);
    onClose();
  }
  async function pickVideo() {
    const path = await window.api.openFileDialog([
      { name: "Video", extensions: ["mp4", "webm", "mov"] }
    ]);
    if (path) setVideoPath(path);
  }
  function addSection() {
    setPreviewIndex(sections.length);
    setSections((prev) => [...prev, {
      type: "verse",
      label: `Verso ${prev.filter((s) => s.type === "verse").length + 1}`,
      lines: []
    }]);
  }
  function removeSection(index) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }
  function updateSection(index, patch) {
    setSections((prev) => prev.map((s, i) => i === index ? { ...s, ...patch } : s));
  }
  function updateLines(index, text) {
    updateSection(index, { lines: text.split("\n") });
  }
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  function handleDragEnd(event) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((_, i) => `section-${i}` === active.id);
      const newIndex = sections.findIndex((_, i) => `section-${i}` === over.id);
      setSections((prev) => arrayMove(prev, oldIndex, newIndex));
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col h-full p-6 overflow-y-auto", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4 mb-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: onClose,
          className: "text-slate-400 hover:text-white transition-colors text-lg",
          children: "← Volver"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-bold flex-1", children: song.id ? "Editar canción" : "Nueva canción" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: handleSave,
          disabled: saving || !title.trim(),
          className: "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95",
          children: saving ? "Guardando..." : "Guardar canción"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-4 mb-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-sm text-slate-400 mb-1.5", children: "Título *" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            value: title,
            onChange: (e) => setTitle(e.target.value),
            className: "w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700",
            placeholder: "Nombre de la canción"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-sm text-slate-400 mb-1.5", children: "Artista / Autor" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            value: artist,
            onChange: (e) => setArtist(e.target.value),
            className: "w-full bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700",
            placeholder: "Opcional"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-sm text-slate-400 mb-1.5", children: "Video de fondo" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            value: videoPath,
            onChange: (e) => setVideoPath(e.target.value),
            className: "flex-1 bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm",
            placeholder: "Ruta del video (MP4, WebM, MOV)"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: pickVideo,
            className: "bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl text-sm transition-colors border border-slate-600",
            children: "Explorar..."
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AudioPanel, { songId: song.id, sections }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6 bg-slate-800 rounded-2xl p-4 border border-slate-700", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-xs font-semibold text-slate-400 mb-4 uppercase tracking-widest", children: "Estilo del texto en pantalla" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-xs text-slate-400 mb-2", children: "Fuente" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-1.5", children: ["sans", "rounded", "bold-condensed"].map((f) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => updateTextStyle({ font: f }),
              className: `flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${textStyle.font === f ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"}`,
              children: f === "sans" ? "Sans" : f === "rounded" ? "Redondo" : "Bold"
            },
            f
          )) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-xs text-slate-400 mb-2", children: "Tamaño" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-1.5", children: ["sm", "md", "lg", "xl"].map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => updateTextStyle({ size: s }),
              className: `flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${textStyle.size === s ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"}`,
              children: s.toUpperCase()
            },
            s
          )) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-xs text-slate-400 mb-2", children: "Posición" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-1.5", children: [["top", "↑ Arriba"], ["center", "↕ Centro"], ["bottom", "↓ Abajo"]].map(([pos, lbl]) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => updateTextStyle({ position: pos }),
              className: `flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                    ${textStyle.position === pos ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"}`,
              children: lbl
            },
            pos
          )) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-xs text-slate-400 mb-2", children: "Color y efectos" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "color",
                value: textStyle.color ?? "#FFFFFF",
                onChange: (e) => updateTextStyle({ color: e.target.value }),
                className: "w-9 h-9 rounded-lg cursor-pointer border border-slate-600 bg-slate-700 p-0.5 shrink-0",
                title: "Color del texto"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => updateTextStyle({ shadow: !textStyle.shadow }),
                className: `flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                  ${textStyle.shadow ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"}`,
                children: "Sombra"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => updateTextStyle({ stroke: !textStyle.stroke }),
                className: `flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border
                  ${textStyle.stroke ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"}`,
                children: "Contorno"
              }
            )
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mb-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "Secciones" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setShowImport(true),
            className: "text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl transition-colors border border-slate-600",
            children: "Importar letra"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: addSection,
            className: "text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-xl transition-colors border border-slate-600",
            children: "+ Añadir sección"
          }
        )
      ] })
    ] }),
    sections.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center py-10 text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl mb-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-3xl mb-2", children: "🎼" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Sin secciones. Añade un Verso, Coro, Puente..." })
    ] }),
    showImport && /* @__PURE__ */ jsxRuntimeExports.jsx(
      LyricsImportModal,
      {
        onApply: (imported) => {
          setSections(imported);
          setShowImport(false);
        },
        onClose: () => setShowImport(false)
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-[minmax(0,1fr)_minmax(300px,42%)] gap-5 items-start", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DndContext, { sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableContext, { items: sections.map((_, i) => `section-${i}`), strategy: verticalListSortingStrategy, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-4", children: sections.map((section, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        SortableSectionCard,
        {
          id: `section-${i}`,
          section,
          index: i,
          previewing: i === Math.min(previewIndex, sections.length - 1),
          onPreview: setPreviewIndex,
          onUpdate: updateSection,
          onUpdateLines: updateLines,
          onRemove: removeSection
        },
        `section-${i}`
      )) }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "sticky top-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        SongPreview,
        {
          sections,
          selected: previewIndex,
          onSelect: setPreviewIndex,
          textStyle,
          videoPath
        }
      ) })
    ] })
  ] });
}
function SongCard({ song, onEdit, onDelete, onRemoveFromFolder }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `song-${song.id}`,
    data: { songId: song.id }
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : void 0;
  const firstSection = song.sections[0];
  const preview = firstSection?.lines.slice(0, 2).join(" · ") ?? "";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      className: `bg-slate-800 rounded-2xl p-4 transition-all duration-200 group border border-slate-700 hover:border-slate-600 hover:bg-slate-750 cursor-grab active:cursor-grabbing select-none${isDragging ? " opacity-40 scale-95 shadow-2xl z-50" : ""}`,
      ...attributes,
      ...listeners,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between mb-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-semibold text-white truncate", children: song.title }),
            song.artist && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400 truncate", children: song.artist })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity",
              onPointerDown: (e) => e.stopPropagation(),
              children: [
                onRemoveFromFolder && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      onRemoveFromFolder();
                    },
                    className: "text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-xs",
                    title: "Sacar de carpeta",
                    children: "📤"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      onEdit();
                    },
                    className: "text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors",
                    title: "Editar",
                    children: "✏️"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      onDelete();
                    },
                    className: "text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700 transition-colors",
                    title: "Eliminar",
                    children: "🗑️"
                  }
                )
              ]
            }
          )
        ] }),
        preview && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-500 truncate mt-1", children: preview }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mt-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-slate-600", children: [
            song.sections.length,
            " sección",
            song.sections.length !== 1 ? "es" : ""
          ] }),
          song.video_path && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-full", children: "🎬 Video" })
        ] })
      ]
    }
  );
}
function FolderCard({ folder, onEnter, onRename, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
    data: { folderId: folder.id }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: setNodeRef,
      onClick: onEnter,
      className: `relative group flex flex-col items-center justify-center gap-2 w-36 h-24 rounded-2xl border cursor-pointer transition-all duration-150 select-none
        ${isOver ? "border-indigo-400 bg-indigo-950 scale-105" : "border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-750"}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-3xl leading-none", children: "📁" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium text-slate-300 max-w-[7rem] truncate text-center px-1", children: folder.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            onPointerDown: (e) => e.stopPropagation(),
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: onRename,
                  className: "text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors text-xs",
                  title: "Renombrar",
                  children: "✏️"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: onDelete,
                  className: "text-slate-400 hover:text-red-400 p-1 rounded-lg hover:bg-slate-700 transition-colors text-xs",
                  title: "Eliminar carpeta",
                  children: "🗑️"
                }
              )
            ]
          }
        )
      ]
    }
  );
}
function FolderRow({ folders, onEnter, onRename, onDelete }) {
  if (folders.length === 0) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3", children: "Carpetas" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-3", children: folders.map((folder) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      FolderCard,
      {
        folder,
        onEnter: () => onEnter(folder),
        onRename: () => onRename(folder),
        onDelete: () => onDelete(folder)
      },
      folder.id
    )) })
  ] });
}
function CreateFolderModal({ onConfirm, onCancel }) {
  const [name, setName] = reactExports.useState("Nueva carpeta");
  const inputRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    inputRef.current?.select();
  }, []);
  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 bg-black/60 flex items-center justify-center z-50", onClick: onCancel, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl",
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-white font-semibold mb-4", children: "Nueva carpeta" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              ref: inputRef,
              type: "text",
              value: name,
              onChange: (e) => setName(e.target.value),
              className: "w-full bg-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600 mb-4",
              autoFocus: true
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2 justify-end", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                onClick: onCancel,
                className: "px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors",
                children: "Cancelar"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "submit",
                className: "px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors",
                children: "Crear"
              }
            )
          ] })
        ] })
      ]
    }
  ) });
}
function RenameFolderModal({ folder, onConfirm, onCancel }) {
  const [name, setName] = reactExports.useState(folder.name);
  const inputRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    inputRef.current?.select();
  }, []);
  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 bg-black/60 flex items-center justify-center z-50", onClick: onCancel, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl",
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-white font-semibold mb-4", children: "Renombrar carpeta" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              ref: inputRef,
              type: "text",
              value: name,
              onChange: (e) => setName(e.target.value),
              className: "w-full bg-slate-700 text-white placeholder-slate-400 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-600 mb-4",
              autoFocus: true
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2 justify-end", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                onClick: onCancel,
                className: "px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors",
                children: "Cancelar"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "submit",
                className: "px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors",
                children: "Guardar"
              }
            )
          ] })
        ] })
      ]
    }
  ) });
}
function RootDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: "root", data: { folderId: null } });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      ref: setNodeRef,
      className: `min-h-32 rounded-2xl transition-all duration-150 ${isOver ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900" : ""}`,
      children
    }
  );
}
function SongsPage() {
  const { songs, loading: songsLoading, searchQuery, setSearchQuery, fetchSongs, deleteSong } = useSongsStore();
  const {
    folders,
    currentFolderId,
    songsInView,
    loading: foldersLoading,
    fetchFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    enterFolder,
    moveSongToFolder,
    refreshSongsInView
  } = useFoldersStore();
  const [editingSong, setEditingSong] = reactExports.useState(null);
  const [showEditor, setShowEditor] = reactExports.useState(false);
  const [showCreateModal, setShowCreateModal] = reactExports.useState(false);
  const [renamingFolder, setRenamingFolder] = reactExports.useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  reactExports.useEffect(() => {
    fetchFolders();
    enterFolder(null);
  }, []);
  reactExports.useEffect(() => {
    const timeout = setTimeout(() => fetchSongs(searchQuery || void 0), 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);
  function openNew() {
    setEditingSong({ title: "", sections: [], text_style: {} });
    setShowEditor(true);
  }
  async function importPack() {
    try {
      const info = await window.api.packInspect();
      if (!info) return;
      let mode = "copy";
      if (info.duplicateOf !== null) {
        const choice = await ask({
          title: "La canción ya existe",
          message: `"${info.title}" ya está en tu biblioteca.`,
          actions: [
            { label: "No importar", value: "cancel", variant: "neutral" },
            { label: "Crear copia", value: "copy", variant: "neutral" },
            { label: "Reemplazar", value: "replace", variant: "danger" }
          ]
        });
        if (choice !== "copy" && choice !== "replace") return;
        mode = choice;
      }
      await window.api.packImport(info.path, mode);
      await fetchSongs();
      await refreshSongsInView();
    } catch (e) {
      await alertDialog(e.message, "No se pudo importar");
    }
  }
  function openEdit(song) {
    setEditingSong(song);
    setShowEditor(true);
  }
  function closeEditor() {
    setShowEditor(false);
    setEditingSong(null);
    fetchSongs(searchQuery || void 0);
    refreshSongsInView();
  }
  async function handleDelete(song) {
    if (await confirmDialog(`¿Eliminar "${song.title}"?`, { title: "Eliminar canción", confirmLabel: "Eliminar", danger: true })) {
      await deleteSong(song.id);
      refreshSongsInView();
    }
  }
  async function handleDeleteFolder(folder) {
    if (await confirmDialog(`¿Eliminar la carpeta "${folder.name}"? Las canciones dentro quedarán sin carpeta.`, { title: "Eliminar carpeta", confirmLabel: "Eliminar", danger: true })) {
      await deleteFolder(folder.id);
    }
  }
  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const songId = active.data.current?.songId;
    const folderId = over.data.current?.folderId;
    if (songId == null || folderId === void 0) return;
    await moveSongToFolder(songId, folderId);
  }
  if (showEditor && editingSong) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(SongEditor, { song: editingSong, onClose: closeEditor });
  }
  const isSearching = searchQuery.length > 0;
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const loading = isSearching ? songsLoading : foldersLoading;
  const displayedSongs = isSearching ? songs : songsInView;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mb-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        currentFolderId !== null && !isSearching && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => enterFolder(null),
            className: "text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1",
            children: "← Canciones"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-bold", children: currentFolderId !== null && !isSearching ? currentFolder?.name ?? "Carpeta" : "Canciones" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
        currentFolderId === null && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setShowCreateModal(true),
            className: "bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 text-sm",
            children: "+ Nueva carpeta"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: importPack,
            className: "bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 text-sm",
            children: "Importar paquete"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: openNew,
            className: "bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95",
            children: "+ Nueva canción"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        type: "search",
        placeholder: "Buscar por título o artista...",
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        className: "w-full bg-slate-800 text-white placeholder-slate-400 rounded-xl px-4 py-3 mb-6 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DndContext, { sensors, onDragEnd: handleDragEnd, children: [
      !isSearching && currentFolderId === null && /* @__PURE__ */ jsxRuntimeExports.jsx(
        FolderRow,
        {
          folders,
          onEnter: (folder) => enterFolder(folder.id),
          onRename: (folder) => setRenamingFolder(folder),
          onDelete: handleDeleteFolder
        }
      ),
      loading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-center py-20 text-slate-500", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Cargando..." })
      ] }) : displayedSongs.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center py-20 text-slate-500", children: currentFolderId !== null && !isSearching ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-5xl mb-4", children: "📂" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-lg font-medium text-slate-400", children: "Esta carpeta está vacía" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm mt-1", children: "Arrastra canciones aquí para organizarlas" })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-5xl mb-4", children: "🎵" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-lg font-medium text-slate-400", children: "No hay canciones aún" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm mt-1", children: 'Pulsa "+ Nueva canción" para comenzar' })
      ] }) }) : (
        /* Song grid — wrapped in RootDropZone when inside a folder so songs can be dragged out */
        currentFolderId !== null && !isSearching ? /* @__PURE__ */ jsxRuntimeExports.jsx(RootDropZone, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(SongsGrid, { songs: displayedSongs, onEdit: openEdit, onDelete: handleDelete, insideFolder: true, onRemoveFromFolder: (s) => moveSongToFolder(s.id, null) }) }) : /* @__PURE__ */ jsxRuntimeExports.jsx(SongsGrid, { songs: displayedSongs, onEdit: openEdit, onDelete: handleDelete })
      )
    ] }),
    showCreateModal && /* @__PURE__ */ jsxRuntimeExports.jsx(
      CreateFolderModal,
      {
        onConfirm: async (name) => {
          await createFolder(name);
          setShowCreateModal(false);
        },
        onCancel: () => setShowCreateModal(false)
      }
    ),
    renamingFolder && /* @__PURE__ */ jsxRuntimeExports.jsx(
      RenameFolderModal,
      {
        folder: renamingFolder,
        onConfirm: async (name) => {
          await renameFolder(renamingFolder.id, name);
          setRenamingFolder(null);
        },
        onCancel: () => setRenamingFolder(null)
      }
    )
  ] });
}
function SongsGrid({
  songs,
  onEdit,
  onDelete,
  insideFolder,
  onRemoveFromFolder
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: songs.map((song) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    SongCard,
    {
      song,
      onEdit: () => onEdit(song),
      onDelete: () => onDelete(song),
      onRemoveFromFolder: insideFolder && onRemoveFromFolder ? () => onRemoveFromFolder(song) : void 0
    },
    song.id
  )) });
}
const useSetlistsStore = create((set) => ({
  setlists: [],
  loading: false,
  fetchSetlists: async () => {
    set({ loading: true });
    const setlists = await window.api.getSetlists();
    set({ setlists, loading: false });
  },
  saveSetlist: async (setlist) => {
    const id = await window.api.saveSetlist(setlist);
    const setlists = await window.api.getSetlists();
    set({ setlists });
    return id;
  },
  deleteSetlist: async (id) => {
    await window.api.deleteSetlist(id);
    const setlists = await window.api.getSetlists();
    set({ setlists });
  }
}));
const __vite_import_meta_env__ = {};
function createJSONStorage(getStorage, options) {
  let storage;
  try {
    storage = getStorage();
  } catch (_e) {
    return;
  }
  const persistStorage = {
    getItem: (name) => {
      var _a;
      const parse = (str2) => {
        if (str2 === null) {
          return null;
        }
        return JSON.parse(str2, void 0);
      };
      const str = (_a = storage.getItem(name)) != null ? _a : null;
      if (str instanceof Promise) {
        return str.then(parse);
      }
      return parse(str);
    },
    setItem: (name, newValue) => storage.setItem(
      name,
      JSON.stringify(newValue, void 0)
    ),
    removeItem: (name) => storage.removeItem(name)
  };
  return persistStorage;
}
const toThenable = (fn) => (input) => {
  try {
    const result = fn(input);
    if (result instanceof Promise) {
      return result;
    }
    return {
      then(onFulfilled) {
        return toThenable(onFulfilled)(result);
      },
      catch(_onRejected) {
        return this;
      }
    };
  } catch (e) {
    return {
      then(_onFulfilled) {
        return this;
      },
      catch(onRejected) {
        return toThenable(onRejected)(e);
      }
    };
  }
};
const oldImpl = (config, baseOptions) => (set, get, api) => {
  let options = {
    getStorage: () => localStorage,
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    partialize: (state) => state,
    version: 0,
    merge: (persistedState, currentState) => ({
      ...currentState,
      ...persistedState
    }),
    ...baseOptions
  };
  let hasHydrated = false;
  const hydrationListeners = /* @__PURE__ */ new Set();
  const finishHydrationListeners = /* @__PURE__ */ new Set();
  let storage;
  try {
    storage = options.getStorage();
  } catch (_e) {
  }
  if (!storage) {
    return config(
      (...args) => {
        console.warn(
          `[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`
        );
        set(...args);
      },
      get,
      api
    );
  }
  const thenableSerialize = toThenable(options.serialize);
  const setItem = () => {
    const state = options.partialize({ ...get() });
    let errorInSync;
    const thenable = thenableSerialize({ state, version: options.version }).then(
      (serializedValue) => storage.setItem(options.name, serializedValue)
    ).catch((e) => {
      errorInSync = e;
    });
    if (errorInSync) {
      throw errorInSync;
    }
    return thenable;
  };
  const savedSetState = api.setState;
  api.setState = (state, replace) => {
    savedSetState(state, replace);
    void setItem();
  };
  const configResult = config(
    (...args) => {
      set(...args);
      void setItem();
    },
    get,
    api
  );
  let stateFromStorage;
  const hydrate = () => {
    var _a;
    if (!storage) return;
    hasHydrated = false;
    hydrationListeners.forEach((cb) => cb(get()));
    const postRehydrationCallback = ((_a = options.onRehydrateStorage) == null ? void 0 : _a.call(options, get())) || void 0;
    return toThenable(storage.getItem.bind(storage))(options.name).then((storageValue) => {
      if (storageValue) {
        return options.deserialize(storageValue);
      }
    }).then((deserializedStorageValue) => {
      if (deserializedStorageValue) {
        if (typeof deserializedStorageValue.version === "number" && deserializedStorageValue.version !== options.version) {
          if (options.migrate) {
            return options.migrate(
              deserializedStorageValue.state,
              deserializedStorageValue.version
            );
          }
          console.error(
            `State loaded from storage couldn't be migrated since no migrate function was provided`
          );
        } else {
          return deserializedStorageValue.state;
        }
      }
    }).then((migratedState) => {
      var _a2;
      stateFromStorage = options.merge(
        migratedState,
        (_a2 = get()) != null ? _a2 : configResult
      );
      set(stateFromStorage, true);
      return setItem();
    }).then(() => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(stateFromStorage, void 0);
      hasHydrated = true;
      finishHydrationListeners.forEach((cb) => cb(stateFromStorage));
    }).catch((e) => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(void 0, e);
    });
  };
  api.persist = {
    setOptions: (newOptions) => {
      options = {
        ...options,
        ...newOptions
      };
      if (newOptions.getStorage) {
        storage = newOptions.getStorage();
      }
    },
    clearStorage: () => {
      storage == null ? void 0 : storage.removeItem(options.name);
    },
    getOptions: () => options,
    rehydrate: () => hydrate(),
    hasHydrated: () => hasHydrated,
    onHydrate: (cb) => {
      hydrationListeners.add(cb);
      return () => {
        hydrationListeners.delete(cb);
      };
    },
    onFinishHydration: (cb) => {
      finishHydrationListeners.add(cb);
      return () => {
        finishHydrationListeners.delete(cb);
      };
    }
  };
  hydrate();
  return stateFromStorage || configResult;
};
const newImpl = (config, baseOptions) => (set, get, api) => {
  let options = {
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => state,
    version: 0,
    merge: (persistedState, currentState) => ({
      ...currentState,
      ...persistedState
    }),
    ...baseOptions
  };
  let hasHydrated = false;
  const hydrationListeners = /* @__PURE__ */ new Set();
  const finishHydrationListeners = /* @__PURE__ */ new Set();
  let storage = options.storage;
  if (!storage) {
    return config(
      (...args) => {
        console.warn(
          `[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`
        );
        set(...args);
      },
      get,
      api
    );
  }
  const setItem = () => {
    const state = options.partialize({ ...get() });
    return storage.setItem(options.name, {
      state,
      version: options.version
    });
  };
  const savedSetState = api.setState;
  api.setState = (state, replace) => {
    savedSetState(state, replace);
    void setItem();
  };
  const configResult = config(
    (...args) => {
      set(...args);
      void setItem();
    },
    get,
    api
  );
  api.getInitialState = () => configResult;
  let stateFromStorage;
  const hydrate = () => {
    var _a, _b;
    if (!storage) return;
    hasHydrated = false;
    hydrationListeners.forEach((cb) => {
      var _a2;
      return cb((_a2 = get()) != null ? _a2 : configResult);
    });
    const postRehydrationCallback = ((_b = options.onRehydrateStorage) == null ? void 0 : _b.call(options, (_a = get()) != null ? _a : configResult)) || void 0;
    return toThenable(storage.getItem.bind(storage))(options.name).then((deserializedStorageValue) => {
      if (deserializedStorageValue) {
        if (typeof deserializedStorageValue.version === "number" && deserializedStorageValue.version !== options.version) {
          if (options.migrate) {
            return [
              true,
              options.migrate(
                deserializedStorageValue.state,
                deserializedStorageValue.version
              )
            ];
          }
          console.error(
            `State loaded from storage couldn't be migrated since no migrate function was provided`
          );
        } else {
          return [false, deserializedStorageValue.state];
        }
      }
      return [false, void 0];
    }).then((migrationResult) => {
      var _a2;
      const [migrated, migratedState] = migrationResult;
      stateFromStorage = options.merge(
        migratedState,
        (_a2 = get()) != null ? _a2 : configResult
      );
      set(stateFromStorage, true);
      if (migrated) {
        return setItem();
      }
    }).then(() => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(stateFromStorage, void 0);
      stateFromStorage = get();
      hasHydrated = true;
      finishHydrationListeners.forEach((cb) => cb(stateFromStorage));
    }).catch((e) => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(void 0, e);
    });
  };
  api.persist = {
    setOptions: (newOptions) => {
      options = {
        ...options,
        ...newOptions
      };
      if (newOptions.storage) {
        storage = newOptions.storage;
      }
    },
    clearStorage: () => {
      storage == null ? void 0 : storage.removeItem(options.name);
    },
    getOptions: () => options,
    rehydrate: () => hydrate(),
    hasHydrated: () => hasHydrated,
    onHydrate: (cb) => {
      hydrationListeners.add(cb);
      return () => {
        hydrationListeners.delete(cb);
      };
    },
    onFinishHydration: (cb) => {
      finishHydrationListeners.add(cb);
      return () => {
        finishHydrationListeners.delete(cb);
      };
    }
  };
  if (!options.skipHydration) {
    hydrate();
  }
  return stateFromStorage || configResult;
};
const persistImpl = (config, baseOptions) => {
  if ("getStorage" in baseOptions || "serialize" in baseOptions || "deserialize" in baseOptions) {
    if ((__vite_import_meta_env__ ? "production" : void 0) !== "production") {
      console.warn(
        "[DEPRECATED] `getStorage`, `serialize` and `deserialize` options are deprecated. Use `storage` option instead."
      );
    }
    return oldImpl(config, baseOptions);
  }
  return newImpl(config, baseOptions);
};
const persist = persistImpl;
function todayISO() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
let keySeq = 0;
const newKey = (songId) => `${songId ?? "x"}-${Date.now()}-${keySeq++}`;
const noopStorage = { getItem: () => null, setItem: () => {
}, removeItem: () => {
} };
const blank = () => ({
  setlistId: null,
  name: `Servicio ${(/* @__PURE__ */ new Date()).toLocaleDateString("es")}`,
  serviceDate: todayISO(),
  items: [],
  dirty: false
});
const useServiceDraftStore = create()(persist((set, get) => ({
  ...blank(),
  addSong: (song) => {
    if (get().items.some((i) => i.song.id === song.id)) return;
    set({ items: [...get().items, { key: newKey(song.id), song }], dirty: true });
  },
  removeItem: (key) => set({ items: get().items.filter((i) => i.key !== key), dirty: true }),
  moveItem: (fromKey, toKey) => {
    const items = [...get().items];
    const from = items.findIndex((i) => i.key === fromKey);
    const to = items.findIndex((i) => i.key === toKey);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    set({ items, dirty: true });
  },
  setName: (name) => set({ name, dirty: true }),
  setServiceDate: (serviceDate) => set({ serviceDate, dirty: true }),
  loadSaved: (saved) => set({
    setlistId: saved.id ?? null,
    name: saved.name,
    serviceDate: saved.service_date ?? todayISO(),
    items: (saved.songs ?? []).map((s) => ({ key: newKey(s.song.id), song: s.song })),
    dirty: false
  }),
  reset: () => set(blank()),
  markSaved: (id) => set({ setlistId: id, dirty: false }),
  syncWithCatalog: (all) => {
    const byId = new Map(all.map((s) => [s.id, s]));
    set({
      items: get().items.filter((i) => byId.has(i.song.id)).map((i) => ({ ...i, song: byId.get(i.song.id) }))
    });
  }
}), {
  name: "alado-service-draft",
  storage: createJSONStorage(() => typeof localStorage !== "undefined" ? localStorage : noopStorage),
  partialize: ({ setlistId, name, serviceDate, items, dirty }) => ({ setlistId, name, serviceDate, items, dirty })
}));
function ipcErrorMessage(e) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, "");
}
function importSummaryText(s) {
  const lines = [];
  if (s.reused > 0) {
    lines.push(s.reused === 1 ? "1 canción ya estaba en esta compu." : `${s.reused} canciones ya estaban en esta compu.`);
  }
  if (s.created.length) lines.push(`Se crearon: ${s.created.join(", ")}`);
  if (s.differing.length) lines.push(`Con letra distinta (se usó la de esta compu): ${s.differing.join(", ")}`);
  if (s.missingVideo.length) lines.push(`Sin video (fondo por defecto): ${s.missingVideo.join(", ")}`);
  if (s.missingAudio.length) lines.push(`Sin audio en esta compu: ${s.missingAudio.join(", ")}`);
  return lines.join("\n");
}
const scriptRel = /* @__PURE__ */ (function detectScriptRel() {
  const relList = typeof document !== "undefined" && document.createElement("link").relList;
  return relList && relList.supports && relList.supports("modulepreload") ? "modulepreload" : "preload";
})();
const assetsURL = function(dep, importerUrl) {
  return new URL(dep, importerUrl).href;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    let allSettled = function(promises$2) {
      return Promise.all(promises$2.map((p) => Promise.resolve(p).then((value$1) => ({
        status: "fulfilled",
        value: value$1
      }), (reason) => ({
        status: "rejected",
        reason
      }))));
    };
    const links = document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
    const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
    promise = allSettled(deps.map((dep) => {
      dep = assetsURL(dep, importerUrl);
      if (dep in seen) return;
      seen[dep] = true;
      const isCss = dep.endsWith(".css");
      const cssSelector = isCss ? '[rel="stylesheet"]' : "";
      if (!!importerUrl) for (let i$1 = links.length - 1; i$1 >= 0; i$1--) {
        const link$1 = links[i$1];
        if (link$1.href === dep && (!isCss || link$1.rel === "stylesheet")) return;
      }
      else if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) return;
      const link = document.createElement("link");
      link.rel = isCss ? "stylesheet" : scriptRel;
      if (!isCss) link.as = "script";
      link.crossOrigin = "";
      link.href = dep;
      if (cspNonce) link.setAttribute("nonce", cspNonce);
      document.head.appendChild(link);
      if (isCss) return new Promise((res, rej) => {
        link.addEventListener("load", res);
        link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
      });
    }));
  }
  function handlePreloadError(err$2) {
    const e$1 = new Event("vite:preloadError", { cancelable: true });
    e$1.payload = err$2;
    window.dispatchEvent(e$1);
    if (!e$1.defaultPrevented) throw err$2;
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
function buildDeckPlan(songs) {
  return songs.flatMap((song, songIndex) => [
    { kind: "title", songIndex, title: song.title, ...song.artist ? { artist: song.artist } : {} },
    ...song.sections.map((s) => ({ kind: "section", songIndex, text: s.lines.join("\n"), repeat: s.repeat ?? 1 }))
  ]);
}
const MAX_PT = 40;
const MIN_PT = 20;
const BOX_W_PT = 12.3 * 72;
const BOX_H_PT = 6.3 * 72;
const CHAR_W = 0.55;
const LINE_H = 1.25;
function fitFontSize(text) {
  const lines = text.split("\n");
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const byHeight = BOX_H_PT / (LINE_H * lines.length);
  const byWidth = BOX_W_PT / (CHAR_W * longest);
  return Math.round(Math.max(MIN_PT, Math.min(MAX_PT, byHeight, byWidth)));
}
const FRAME_MAX_W = 1280;
const FRAME_MAX_H = 720;
const FRAME_TIMEOUT_MS = 8e3;
const DARKEN = "rgba(0,0,0,0.35)";
function grabVideoFrame(videoPath) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), FRAME_TIMEOUT_MS);
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = Math.min(1, d * 0.1);
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, FRAME_MAX_W / video.videoWidth, FRAME_MAX_H / video.videoHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = DARKEN;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.7));
      } catch (e) {
        console.warn("No se pudo leer un cuadro del video", videoPath, e);
        finish(null);
      }
    };
    video.src = mediaUrl(videoPath);
  });
}
const PLAIN_BG = "0F172A";
const SHADOW = { type: "outer", color: "000000", blur: 6, offset: 2, angle: 45, opacity: 0.8 };
async function exportServicePptx(name, songs) {
  const { default: PptxGenJS } = await __vitePreload(async () => {
    const { default: PptxGenJS2 } = await import("./pptxgen.es-CGqMXVdN.js");
    return { default: PptxGenJS2 };
  }, true ? __vite__mapDeps([0,1]) : void 0, import.meta.url);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = name;
  const frames = await Promise.all(songs.map((s) => s.video_path ? grabVideoFrame(s.video_path) : Promise.resolve(null)));
  for (const spec of buildDeckPlan(songs)) {
    const slide = pptx.addSlide();
    const frame = frames[spec.songIndex];
    slide.background = frame ? { data: frame.replace(/^data:/, ""), path: "frame.jpg" } : { color: PLAIN_BG };
    if (spec.kind === "title") {
      slide.addText(spec.title, {
        x: 0.5,
        y: spec.artist ? 2.4 : 2.9,
        w: 12.33,
        h: 1.6,
        align: "center",
        valign: "middle",
        fontSize: 48,
        bold: true,
        color: "FFFFFF",
        shadow: SHADOW,
        fit: "shrink"
      });
      if (spec.artist) {
        slide.addText(spec.artist, { x: 0.5, y: 4, w: 12.33, h: 0.8, align: "center", fontSize: 24, color: "CBD5E1", shadow: SHADOW });
      }
    } else {
      slide.addText(spec.text, {
        x: 0.5,
        y: 0.6,
        w: 12.33,
        h: 6.3,
        align: "center",
        valign: "middle",
        fontSize: fitFontSize(spec.text),
        bold: true,
        color: "FFFFFF",
        shadow: SHADOW,
        fit: "shrink"
      });
      if (spec.repeat > 1) {
        slide.addText(`×${spec.repeat}`, { x: 11.3, y: 6.8, w: 1.8, h: 0.5, align: "right", fontSize: 18, color: "CBD5E1" });
      }
    }
  }
  const bytes = await pptx.write({ outputType: "uint8array" });
  return window.api.setlistSavePptx({ bytes, defaultName: name });
}
const TOAST_MS = 2500;
let seq = 0;
const useToastStore = create(() => ({ toasts: [] }));
function showToast(message, kind = "success") {
  const id = ++seq;
  useToastStore.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  setTimeout(() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), TOAST_MS);
}
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function matchesQuery(song, query) {
  const q = fold(query.trim());
  return !q || fold(song.title).includes(q) || fold(song.artist ?? "").includes(q);
}
function groupSongs(songs, folders, filter, query) {
  const known = new Set(folders.map((f) => f.id));
  const folderOf = (s) => s.folder_id != null && known.has(s.folder_id) ? s.folder_id : null;
  const visible = songs.filter((s) => matchesQuery(s, query));
  const groups = [
    ...folders.map((f) => ({ key: `folder-${f.id}`, name: f.name, id: f.id })),
    { key: "loose", name: "Sin carpeta", id: null }
  ].filter((g) => filter === "all" || g.id === filter).map((g) => ({ key: g.key, name: g.name, songs: visible.filter((s) => folderOf(s) === g.id) }));
  return groups.filter((g) => g.songs.length > 0);
}
function sectionLabel(s) {
  return s.repeat && s.repeat > 1 ? `${s.label} ×${s.repeat}` : s.label;
}
function previewSections(song, maxSections = 2, maxLines = 2) {
  return song.sections.slice(0, maxSections).map((s) => ({
    label: sectionLabel(s),
    lines: s.lines.slice(0, maxLines),
    truncated: s.lines.length > maxLines
  }));
}
const CARD_WIDTH = 288;
const CARD_MAX_HEIGHT = 260;
const GAP = 8;
function LyricsHoverCard({ song, anchorRect }) {
  const preview = previewSections(song);
  const top = Math.max(GAP, Math.min(anchorRect.top, window.innerHeight - CARD_MAX_HEIGHT - GAP));
  const left = Math.min(anchorRect.right + GAP, window.innerWidth - CARD_WIDTH - GAP);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "fixed z-50 pointer-events-none bg-slate-800 border border-indigo-500/70 rounded-2xl shadow-2xl p-4 overflow-hidden",
      style: { top, left, width: CARD_WIDTH, maxHeight: CARD_MAX_HEIGHT },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-semibold text-white truncate", children: song.title }),
        song.artist && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-400 truncate mb-2", children: song.artist }),
        preview.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400 mt-2", children: "Sin letra" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-2 mt-2", children: preview.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] font-bold uppercase tracking-wide text-indigo-300", children: s.label }),
          s.lines.map((l, j) => /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-200 leading-snug", children: l }, j)),
          s.truncated && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "…" })
        ] }, i)) }),
        song.sections.length > preview.length && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-slate-400 mt-2", children: [
          song.sections.length,
          " secciones en total"
        ] })
      ]
    }
  );
}
function SectionList({ song }) {
  if (song.sections.length === 0) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "Sin letra" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-3", children: song.sections.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] font-bold uppercase tracking-wide text-indigo-300", children: sectionLabel(s) }),
    s.lines.map((l, j) => /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-200 leading-snug", children: l }, j))
  ] }, i)) });
}
const HOVER_DELAY_MS = 400;
function SetlistPage() {
  const { songs, fetchSongs } = useSongsStore();
  const { isLive, startLive, stopLive, changeSong, currentSong } = useLiveStore();
  const { setlists, fetchSetlists, saveSetlist } = useSetlistsStore();
  const { folders, fetchFolders } = useFoldersStore();
  const {
    setlistId,
    name: setlistName,
    serviceDate,
    items: setlistSongs,
    dirty,
    addSong,
    removeItem,
    moveItem,
    setName,
    setServiceDate,
    loadSaved,
    reset,
    markSaved,
    syncWithCatalog
  } = useServiceDraftStore();
  const [searchQuery, setSearchQuery] = reactExports.useState("");
  const [folderFilter, setFolderFilter] = reactExports.useState("all");
  const [showSaved, setShowSaved] = reactExports.useState(false);
  const [saving, setSaving] = reactExports.useState(false);
  const [showExport, setShowExport] = reactExports.useState(false);
  const [hover, setHover] = reactExports.useState(null);
  const hoverTimer = reactExports.useRef(null);
  reactExports.useEffect(() => {
    fetchSongs().then(() => syncWithCatalog(useSongsStore.getState().songs));
    fetchSetlists();
    fetchFolders();
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const groups = groupSongs(songs, folders, folderFilter, searchQuery);
  const hasLoose = songs.some((s) => s.folder_id == null || !folders.some((f) => f.id === s.folder_id));
  const inSetlist = new Set(setlistSongs.map((s) => s.song.id));
  function handleDragEnd(event) {
    const { active, over } = event;
    if (over && active.id !== over.id) moveItem(String(active.id), String(over.id));
  }
  async function handlePresent() {
    if (setlistSongs.length === 0) return;
    await startLive(setlistSongs.map((s) => s.song));
  }
  async function canDiscardDraft(message) {
    return !dirty || confirmDialog(message, { title: "Cambios sin guardar", confirmLabel: "Continuar", danger: true });
  }
  async function handleSave() {
    if (setlistSongs.length === 0 || saving) return;
    setSaving(true);
    try {
      const id = await saveSetlist({
        id: setlistId ?? void 0,
        name: setlistName,
        service_date: serviceDate,
        songs: setlistSongs.map((s, i) => ({ song: s.song, position: i }))
      });
      markSaved(id);
      showToast("Servicio guardado");
    } catch (e) {
      console.error("No se pudo guardar el servicio", e);
      showToast("No se pudo guardar el servicio", "error");
    } finally {
      setSaving(false);
    }
  }
  async function handleExportAlado() {
    setShowExport(false);
    try {
      const res = await window.api.setlistExport({
        name: setlistName,
        service_date: serviceDate,
        songIds: setlistSongs.map((s) => s.song.id)
      });
      if (res) showToast("Servicio exportado");
    } catch (e) {
      await alertDialog(ipcErrorMessage(e), "No se pudo exportar");
    }
  }
  async function handleExportPptx() {
    setShowExport(false);
    showToast("Generando PowerPoint…");
    try {
      const res = await exportServicePptx(setlistName, setlistSongs.map((s) => s.song));
      if (res) showToast("PowerPoint exportado");
    } catch (e) {
      await alertDialog(ipcErrorMessage(e), "No se pudo exportar el PowerPoint");
    }
  }
  async function handleImport() {
    if (!await canDiscardDraft("Hay cambios sin guardar. ¿Importar otro servicio de todos modos?")) return;
    try {
      const info = await window.api.setlistImportInspect();
      if (!info) return;
      let mode = "new";
      if (info.duplicateOf) {
        const choice = await ask({
          title: "Este servicio ya existe",
          message: `Ya hay un servicio guardado "${info.name}"${info.service_date ? ` del ${info.service_date}` : ""}. ¿Qué quieres hacer?`,
          actions: [
            { label: "Cancelar", value: "cancel", variant: "neutral" },
            { label: "Crear copia", value: "new", variant: "neutral" },
            { label: "Reemplazar", value: "replace", variant: "primary" }
          ]
        });
        if (choice !== "new" && choice !== "replace") return;
        mode = choice;
      }
      const summary = await window.api.setlistImportApply({ path: info.path, mode, replaceId: info.duplicateOf ?? void 0 });
      await fetchSetlists();
      await fetchSongs();
      const saved = useSetlistsStore.getState().setlists.find((sl) => sl.id === summary.setlistId);
      if (saved) loadSaved(saved);
      await alertDialog(importSummaryText(summary), "Servicio importado");
    } catch (e) {
      await alertDialog(ipcErrorMessage(e), "No se pudo importar");
    }
  }
  async function handleNew() {
    if (!await canDiscardDraft("Hay cambios sin guardar. ¿Empezar un servicio nuevo?")) return;
    reset();
  }
  async function loadSetlist(saved) {
    if (!saved.songs) return;
    setShowSaved(false);
    if (!await canDiscardDraft(`Hay cambios sin guardar. ¿Cargar "${saved.name}" de todos modos?`)) return;
    loadSaved(saved);
  }
  function handleSongClick(song) {
    if (isLive) changeSong(song);
  }
  function scheduleHover(song, el) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover({ song, rect: el.getBoundingClientRect() }), HOVER_DELAY_MS);
  }
  function hideHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHover(null);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full", children: [
    hover && /* @__PURE__ */ jsxRuntimeExports.jsx(LyricsHoverCard, { song: hover.song, anchorRect: hover.rect }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-72 border-r border-slate-800 p-4 flex flex-col bg-slate-950", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-semibold text-slate-300 mb-3 text-sm uppercase tracking-wide", children: "Biblioteca" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "search",
          placeholder: "Buscar canción...",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
          className: "bg-slate-800 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 mb-3"
        }
      ),
      folders.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap gap-1.5 mb-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(FolderChip, { active: folderFilter === "all", onClick: () => setFolderFilter("all"), children: "Todas" }),
        folders.map((f) => /* @__PURE__ */ jsxRuntimeExports.jsx(FolderChip, { active: folderFilter === f.id, onClick: () => setFolderFilter(f.id), children: f.name }, f.id)),
        hasLoose && /* @__PURE__ */ jsxRuntimeExports.jsx(FolderChip, { active: folderFilter === null, onClick: () => setFolderFilter(null), children: "Sin carpeta" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 overflow-y-auto flex flex-col gap-1", onScroll: hideHover, children: [
        groups.map((group) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1", children: [
          folders.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "sticky top-0 z-[1] bg-slate-950 text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1 pt-2 pb-1", children: [
            group.name,
            " · ",
            group.songs.length
          ] }),
          group.songs.map((song) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              onClick: () => addSong(song),
              onMouseEnter: (e) => scheduleHover(song, e.currentTarget),
              onMouseLeave: hideHover,
              className: "text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-all duration-150 group border border-transparent hover:border-slate-700",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: `text-sm font-medium truncate ${inSetlist.has(song.id) ? "text-slate-500" : "text-white"}`, children: [
                  inSetlist.has(song.id) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-emerald-500 mr-1", children: "✓" }),
                  song.title
                ] }),
                song.artist && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-500 truncate", children: song.artist })
              ]
            },
            song.id
          ))
        ] }, group.key)),
        groups.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-600 text-center py-4", children: "Sin resultados" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 p-6 flex flex-col", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 mb-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0 flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              value: setlistName,
              onChange: (e) => setName(e.target.value),
              "aria-label": "Nombre del servicio",
              className: "bg-transparent text-xl font-bold text-white outline-none border-b border-transparent hover:border-slate-600 focus:border-indigo-500 transition-colors pb-1"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 text-xs", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "date",
                value: serviceDate,
                onChange: (e) => e.target.value && setServiceDate(e.target.value),
                "aria-label": "Fecha del servicio",
                className: "bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 outline-none focus:border-indigo-500 [color-scheme:dark]"
              }
            ),
            dirty && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-amber-400", children: "• sin guardar" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: handleNew,
            className: "px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700",
            title: "Empezar un servicio nuevo",
            children: "＋ Nuevo"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => setShowSaved(!showSaved),
              className: "px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700",
              title: "Servicios guardados",
              children: "📂 Cargar"
            }
          ),
          showSaved && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-10 overflow-hidden", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "p-3 border-b border-slate-700", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-semibold text-slate-400 uppercase tracking-wide", children: "Servicios guardados" }) }),
            setlists.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-500 text-center py-6", children: "Sin servicios guardados" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "max-h-64 overflow-y-auto", children: setlists.map((sl) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: () => loadSetlist(sl),
                className: "w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-white", children: sl.name }),
                  sl.service_date && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-slate-500", children: [
                    sl.service_date,
                    " · ",
                    sl.songs?.length ?? 0,
                    " canciones"
                  ] })
                ]
              },
              sl.id
            )) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: handleImport,
            className: "px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors border border-slate-700",
            title: "Importar un servicio desde un archivo .alado",
            children: "📥 Importar"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: handleSave,
            disabled: setlistSongs.length === 0 || saving,
            className: "px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm font-medium transition-colors border border-slate-600",
            children: saving ? "Guardando..." : "💾 Guardar"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => setShowExport((v) => !v),
              disabled: setlistSongs.length === 0,
              className: "px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm transition-colors border border-slate-700",
              title: "Exportar este servicio",
              children: "📤 Exportar ▾"
            }
          ),
          showExport && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute right-0 top-full mt-1 w-60 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-10 overflow-hidden", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: handleExportAlado, className: "w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-white", children: "Archivo .alado" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-400", children: "Para abrirlo en otra compu con ALADO" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: handleExportPptx, className: "w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-white", children: "PowerPoint" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-400", children: "Respaldo para presentar sin ALADO" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: isLive ? stopLive : handlePresent,
            disabled: setlistSongs.length === 0 && !isLive,
            className: `px-7 py-2.5 rounded-xl font-bold text-base transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95
              ${isLive ? "bg-red-600 hover:bg-red-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`,
            children: isLive ? "⏹ Detener" : "▶ Presentar"
          }
        )
      ] }),
      setlistSongs.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1 flex items-center justify-center text-slate-600 text-center border-2 border-dashed border-slate-800 rounded-2xl", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-4xl mb-3", children: "📋" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-slate-500", children: "Pulsa una canción de la biblioteca para añadirla" })
      ] }) }) : /* @__PURE__ */ jsxRuntimeExports.jsx(DndContext, { sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableContext, { items: setlistSongs.map((s) => s.key), strategy: verticalListSortingStrategy, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-2 overflow-y-auto", children: setlistSongs.map((item, index) => {
        const isCurrentSong = isLive && currentSong?.id === item.song.id;
        return /* @__PURE__ */ jsxRuntimeExports.jsx(
          SortableSetlistItem,
          {
            id: item.key,
            song: item.song,
            index,
            isLive,
            isCurrentSong,
            onRemove: () => removeItem(item.key),
            onClick: () => handleSongClick(item.song)
          },
          item.key
        );
      }) }) }) })
    ] })
  ] });
}
function FolderChip({ active, onClick, children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "button",
    {
      onClick,
      className: `px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors
        ${active ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"}`,
      children
    }
  );
}
function SortableSetlistItem({ id, song, index, isLive, isCurrentSong, onRemove, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };
  const [expanded, setExpanded] = reactExports.useState(false);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      onClick: isLive ? onClick : void 0,
      className: `rounded-2xl px-4 py-3 group border transition-all duration-150
        ${isCurrentSong ? "bg-indigo-950 border-indigo-500 border-l-4" : isLive ? "bg-slate-800 border-slate-700 hover:border-indigo-400 hover:bg-slate-750 cursor-pointer" : "bg-slate-800 border-slate-700"}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              ...attributes,
              ...listeners,
              className: "text-slate-600 cursor-grab active:cursor-grabbing text-lg select-none",
              children: "⠿"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `text-sm w-6 text-center font-mono shrink-0
          ${isCurrentSong ? "text-indigo-400" : "text-slate-600"}`, children: isCurrentSong ? "▶" : index + 1 }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: `font-medium truncate ${isCurrentSong ? "text-indigo-100" : "text-white"}`, children: song.title }),
            song.artist && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-500 truncate", children: song.artist })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              onPointerDown: (e) => e.stopPropagation(),
              onClick: (e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              },
              "aria-expanded": expanded,
              title: expanded ? "Ocultar letra" : "Ver letra",
              className: "text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700 transition-colors text-sm",
              children: [
                expanded ? "▾" : "▸",
                " Letra"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                onRemove();
              },
              title: "Quitar del servicio",
              className: "opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all px-1",
              children: "✕"
            }
          )
        ] }),
        expanded && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 ml-14 pl-3 border-l border-slate-700 cursor-default", onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SectionList, { song }) })
      ]
    }
  );
}
function SettingsPage() {
  const [displays, setDisplays] = reactExports.useState([]);
  const [selectedDisplayId, setSelectedDisplayId] = reactExports.useState(
    Number(localStorage.getItem("liveDisplayId")) || null
  );
  const [transitionType, setTransitionType] = reactExports.useState(
    localStorage.getItem("transitionType") ?? "fade"
  );
  const [transitionDuration, setTransitionDuration] = reactExports.useState(
    Number(localStorage.getItem("transitionDuration")) || 250
  );
  const [claudeKey, setClaudeKey] = reactExports.useState(localStorage.getItem("claudeApiKey") ?? "");
  const [claudeKeySaved, setClaudeKeySaved] = reactExports.useState(false);
  const claudeSaveTimer = reactExports.useRef(null);
  reactExports.useEffect(() => {
    window.api.getDisplays().then(setDisplays);
  }, []);
  function selectDisplay(id) {
    setSelectedDisplayId(id);
    localStorage.setItem("liveDisplayId", String(id));
  }
  function applyTransition(type, duration) {
    window.api.setTransition({ type, duration });
    localStorage.setItem("transitionType", type);
    localStorage.setItem("transitionDuration", String(duration));
  }
  function handleTransitionType(type) {
    setTransitionType(type);
    applyTransition(type, transitionDuration);
  }
  function handleTransitionDuration(duration) {
    setTransitionDuration(duration);
    applyTransition(transitionType, duration);
  }
  function saveClaudeKey(key) {
    setClaudeKey(key);
    if (claudeSaveTimer.current) clearTimeout(claudeSaveTimer.current);
    claudeSaveTimer.current = setTimeout(() => {
      if (key.trim()) {
        localStorage.setItem("claudeApiKey", key.trim());
      } else {
        localStorage.removeItem("claudeApiKey");
      }
      setClaudeKeySaved(true);
      setTimeout(() => setClaudeKeySaved(false), 2e3);
    }, 800);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-6 max-w-2xl", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-bold mb-8", children: "Configuración" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mb-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-base font-semibold text-white mb-1", children: "Pantalla de presentación" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400 mb-4", children: "Selecciona en qué monitor se mostrará la ventana de presentación al público." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2", children: [
        displays.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-500", children: "Detectando pantallas..." }),
        displays.map((d) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            onClick: () => selectDisplay(d.id),
            className: `flex items-center gap-4 px-4 py-3 rounded-2xl border text-left transition-all duration-150
                ${selectedDisplayId === d.id ? "bg-indigo-950 border-indigo-500" : "bg-slate-800 border-slate-700 hover:border-slate-600"}`,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center
                ${selectedDisplayId === d.id ? "border-indigo-400" : "border-slate-600"}`, children: selectedDisplayId === d.id && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-2 h-2 rounded-full bg-indigo-400" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm font-medium text-white", children: [
                  d.label || `Pantalla ${d.id}`,
                  d.isPrimary && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-2 text-xs text-slate-500", children: "(Principal)" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-slate-500", children: [
                  d.bounds.width,
                  " × ",
                  d.bounds.height,
                  " px"
                ] })
              ] })
            ]
          },
          d.id
        ))
      ] }),
      displays.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => window.api.getDisplays().then(setDisplays),
          className: "mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors",
          children: "↻ Refrescar pantallas"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mb-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-base font-semibold text-white mb-1", children: "Transición de diapositivas" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400 mb-4", children: "Efecto visual al cambiar de sección durante la presentación." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-3 mb-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => handleTransitionType("fade"),
            className: `flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-150
              ${transitionType === "fade" ? "bg-indigo-950 border-indigo-500 text-indigo-200" : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"}`,
            children: "✨ Fundido"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => handleTransitionType("cut"),
            className: `flex-1 py-3 rounded-xl text-sm font-medium border transition-all duration-150
              ${transitionType === "cut" ? "bg-indigo-950 border-indigo-500 text-indigo-200" : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"}`,
            children: "⚡ Corte directo"
          }
        )
      ] }),
      transitionType === "fade" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-slate-800 rounded-2xl p-4 border border-slate-700", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between mb-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-sm text-slate-300", children: "Duración del fundido" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-sm font-mono text-indigo-400", children: [
            transitionDuration,
            "ms"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "range",
            min: 100,
            max: 800,
            step: 50,
            value: transitionDuration,
            onChange: (e) => handleTransitionDuration(Number(e.target.value)),
            className: "w-full accent-indigo-500"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between text-xs text-slate-600 mt-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "100ms (rápido)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "800ms (lento)" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mb-8", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-base font-semibold text-white mb-1", children: "Importar con IA (Claude API)" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-slate-400 mb-4", children: [
        "Permite usar Claude para importar letras automáticamente desde cualquier URL. Obtén tu clave en",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-indigo-400", children: "console.anthropic.com" }),
        "."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-sm text-slate-400 mb-1.5", children: "Clave API de Anthropic" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "password",
              value: claudeKey,
              onChange: (e) => saveClaudeKey(e.target.value),
              className: "flex-1 bg-slate-800 text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm font-mono",
              placeholder: "sk-ant-..."
            }
          ),
          claudeKeySaved && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex items-center text-xs text-green-400 px-2", children: "Guardado" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-600 mt-1.5", children: "La clave se guarda localmente en este dispositivo y nunca se envía a servidores externos." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-indigo-300", children: "La importación con IA estará disponible en una próxima actualización. Puedes guardar tu clave ahora para tenerla lista." }) })
    ] })
  ] });
}
function LiveControlsPanel() {
  const {
    currentSong,
    currentSectionIndex,
    blackout,
    whiteout,
    nextSection,
    prevSection,
    goToSection,
    toggleBlackout,
    toggleWhiteout,
    stopLive
  } = useLiveStore();
  reactExports.useEffect(() => {
    function onKey(e) {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (useDialogStore.getState().current) return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextSection();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevSection();
          break;
        case "b":
        case "B":
          toggleBlackout();
          break;
        case "w":
        case "W":
          toggleWhiteout();
          break;
        case "Escape":
          stopLive();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!currentSong) return null;
  const sections = currentSong.sections;
  const activeSection = sections[currentSectionIndex];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center gap-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-widest", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" }),
          "En vivo"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-white font-semibold truncate", children: currentSong.title })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bg-slate-900 rounded-xl px-3 py-2 text-sm text-white border border-slate-800", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-indigo-400 font-semibold mr-2", children: activeSection?.label }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-slate-300", children: activeSection?.lines[0] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-1 flex-wrap max-w-sm", children: sections.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: () => goToSection(i),
        className: `px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150
              ${i === currentSectionIndex ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"}`,
        children: s.label
      },
      i
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AudioTransport, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2 shrink-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: prevSection,
          disabled: currentSectionIndex === 0,
          className: "w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors flex items-center justify-center text-lg border border-slate-700",
          title: "Anterior (←)",
          children: "‹"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: nextSection,
          disabled: currentSectionIndex === sections.length - 1,
          className: "w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors flex items-center justify-center text-lg border border-slate-700",
          title: "Siguiente (→ / Espacio)",
          children: "›"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2 shrink-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: toggleBlackout,
          className: `px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 border
            ${blackout ? "bg-slate-700 border-slate-500 text-white shadow-inner" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"}`,
          title: "Pantalla negra (B)",
          children: "■ Negro"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: toggleWhiteout,
          className: `px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 border
            ${whiteout ? "bg-white border-slate-300 text-black" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"}`,
          title: "Pantalla blanca (W)",
          children: "□ Blanco"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: async () => {
            if (await confirmDialog("¿Detener la presentación?", { title: "Detener", confirmLabel: "Detener", danger: true })) stopLive();
          },
          className: "px-3 py-2 rounded-xl text-xs font-bold bg-red-950 border border-red-800 text-red-400 hover:bg-red-700 hover:text-white transition-all duration-150",
          title: "Detener (Escape)",
          children: "⏹ Detener"
        }
      )
    ] })
  ] });
}
function PlaybackController() {
  const currentSong = useLiveStore((s) => s.currentSong);
  const isLive = useLiveStore((s) => s.isLive);
  const pendingAuto = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!isLive || !currentSong?.id) {
      const pb = usePlaybackStore.getState();
      if (pb.songId !== null && !pb.recording) pb.unload();
      return;
    }
    const id = currentSong.id;
    let cancelled = false;
    void (async () => {
      const audio = await useAudioStore.getState().load(id);
      if (cancelled) return;
      if (audio?.status !== "ready") {
        usePlaybackStore.getState().unload();
        return;
      }
      setFollowerCues(null);
      await usePlaybackStore.getState().loadSong(id);
      if (cancelled || usePlaybackStore.getState().songId !== id) return;
      const stale = cuesAreStale(audio.cues, audio.cues_sections_sig, currentSong.sections);
      setFollowerCues(stale ? null : audio.cues);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, currentSong?.id]);
  reactExports.useEffect(() => useLiveStore.subscribe((state, prev) => {
    if (state.currentSectionIndex === prev.currentSectionIndex) return;
    if (pendingAuto.current === state.currentSectionIndex) {
      pendingAuto.current = null;
      return;
    }
    const f = getFollower();
    if (f && usePlaybackStore.getState().playing) {
      f.markManual();
      usePlaybackStore.setState({ manual: true });
    }
  }), []);
  reactExports.useEffect(() => {
    let lastPublished = 0;
    const timer = setInterval(() => {
      const pb = usePlaybackStore.getState();
      if (pb.status !== "ready") return;
      const p = getPlayer();
      const t = p.currentTime;
      if (Math.abs(t - lastPublished) > 0.1 || p.playing !== pb.playing) {
        lastPublished = t;
        usePlaybackStore.setState({ time: t, playing: p.playing });
      }
      const f = getFollower();
      if (f && p.playing && !pb.recording) fire(f.update(t));
    }, 50);
    return () => clearInterval(timer);
  }, []);
  reactExports.useEffect(() => usePlaybackStore.subscribe((state, prev) => {
    const f = getFollower();
    if (!f || state.recording) return;
    if (prev.manual && !state.manual && f.isManual) fire(f.resumeAuto(getPlayer().currentTime));
  }), []);
  function fire(sectionIndex) {
    if (sectionIndex === null) return;
    if (usePlaybackStore.getState().manual) usePlaybackStore.setState({ manual: false });
    const live = useLiveStore.getState();
    if (sectionIndex === live.currentSectionIndex) return;
    pendingAuto.current = sectionIndex;
    void live.goToSection(sectionIndex);
  }
  return null;
}
const VARIANT = {
  primary: "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold",
  danger: "bg-red-600 hover:bg-red-500 text-white font-semibold",
  neutral: "text-slate-400 hover:text-white hover:bg-slate-700"
};
function DialogHost() {
  const current = useDialogStore((s) => s.current);
  const answer = useDialogStore((s) => s.answer);
  const defaultRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!current) return;
    defaultRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        answer(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);
  if (!current) return null;
  const last = current.actions.length - 1;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 bg-black/60 flex items-center justify-center z-[200]", onClick: () => answer(null), children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "dialog-title",
      className: "bg-slate-800 border border-slate-700 rounded-2xl p-6 w-96 max-w-[90vw] shadow-2xl",
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { id: "dialog-title", className: "text-white font-semibold mb-2", children: current.title }),
        current.message && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-300 mb-5 whitespace-pre-line", children: current.message }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-2 justify-end", children: current.actions.map((a, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            ref: i === last ? defaultRef : void 0,
            onClick: () => answer(a.value),
            className: `px-4 py-2 rounded-xl transition-colors ${VARIANT[a.variant ?? "neutral"]}`,
            children: a.label
          },
          a.value
        )) })
      ]
    }
  ) });
}
function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed bottom-6 right-6 z-[250] flex flex-col gap-2 pointer-events-none", role: "status", "aria-live": "polite", children: toasts.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border
            ${t.kind === "error" ? "bg-red-950 border-red-700 text-red-100" : "bg-slate-800 border-emerald-600 text-white"}`,
      children: [
        t.kind === "error" ? "⚠ " : "✓ ",
        t.message
      ]
    },
    t.id
  )) });
}
function App() {
  const [page, setPage] = reactExports.useState("songs");
  const isLive = useLiveStore((s) => s.isLive);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-screen bg-slate-900 text-white overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PlaybackController, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DialogHost, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ToastHost, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "w-20 flex flex-col items-center py-6 gap-1 bg-slate-950 border-r border-slate-800", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(NavBtn, { icon: "🎵", label: "Canciones", active: page === "songs", onClick: () => setPage("songs") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(NavBtn, { icon: "📋", label: "Servicio", active: page === "setlist", onClick: () => setPage("setlist") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(NavBtn, { icon: "⚙️", label: "Ajustes", active: page === "settings", onClick: () => setPage("settings") }),
      isLive && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-auto mb-2 flex flex-col items-center gap-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[9px] font-bold text-red-400 tracking-widest uppercase", children: "Live" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "flex-1 flex flex-col overflow-hidden", children: [
      isLive && /* @__PURE__ */ jsxRuntimeExports.jsx(LiveControlsPanel, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 overflow-y-auto", children: [
        page === "songs" && /* @__PURE__ */ jsxRuntimeExports.jsx(SongsPage, {}),
        page === "setlist" && /* @__PURE__ */ jsxRuntimeExports.jsx(SetlistPage, {}),
        page === "settings" && /* @__PURE__ */ jsxRuntimeExports.jsx(SettingsPage, {})
      ] })
    ] })
  ] });
}
function NavBtn({ icon, label, active, onClick }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "button",
    {
      onClick,
      title: label,
      className: `w-14 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200
        ${active ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xl leading-none", children: icon }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-medium leading-none", children: label })
      ]
    }
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
export {
  __vitePreload as _
};
