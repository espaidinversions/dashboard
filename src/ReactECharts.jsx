import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts } from "./echarts.js";

export default function BoundReactECharts(props) {
  return <ReactEChartsCore echarts={echarts} {...props} />;
}
