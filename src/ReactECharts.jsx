import ReactEChartsCoreModule from "echarts-for-react/lib/core.js";
import { echarts } from "./echarts.js";

function resolveReactComponent(mod) {
  let current = mod;
  while (current && typeof current === "object" && "default" in current) {
    current = current.default;
  }
  return current;
}

const ReactEChartsCore = resolveReactComponent(ReactEChartsCoreModule);

export default function BoundReactECharts(props) {
  if (typeof ReactEChartsCore !== "function") {
    throw new Error("echarts-for-react did not resolve to a React component");
  }
  return <ReactEChartsCore echarts={echarts} {...props} />;
}
