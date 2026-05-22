import { useState, useEffect } from "react";

let _module = null;
let _pending = null;

function loadModule() {
  if (_module) return Promise.resolve(_module);
  if (_pending) return _pending;
  _pending = Promise.all([
    import("echarts-for-react/lib/core.js"),
    import("./echarts.js"),
  ]).then(([coreRaw, ecRaw]) => {
    let core = coreRaw;
    while (core && typeof core === "object" && "default" in core) core = core.default;
    _module = { Component: core, echarts: ecRaw.echarts };
    _pending = null;
    return _module;
  });
  return _pending;
}

export default function BoundReactECharts({ style, ...props }) {
  const [mod, setMod] = useState(_module);

  useEffect(() => {
    if (!mod) {
      loadModule().then(setMod);
    }
  }, []);

  if (!mod) {
    return <div style={{ height: style?.height ?? 200, ...style }} />;
  }
  return <mod.Component echarts={mod.echarts} style={style} {...props} />;
}
