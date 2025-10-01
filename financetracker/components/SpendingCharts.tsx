import { memo, useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, View, ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText, Circle } from "react-native-svg";

import { useAppTheme } from "../theme";

export interface SpendingPoint {
  label: string;
  value: number;
}

interface SpendingChartProps {
  data: SpendingPoint[];
  style?: ViewStyle;
}

const CHART_HEIGHT = 180;
const MIN_CHART_WIDTH = 280;
const VERTICAL_PADDING = 24;

const buildPath = (points: { x: number; y: number }[]) => {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
};

const SpendingLineChartComponent = ({ data, style }: SpendingChartProps) => {
  const theme = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(MIN_CHART_WIDTH);
  const chartWidth = Math.max(containerWidth, MIN_CHART_WIDTH);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width && Math.round(width) !== Math.round(containerWidth)) {
        setContainerWidth(width);
      }
    },
    [containerWidth],
  );

  const { path, points } = useMemo(() => {
    if (!data.length) {
      return { path: "", points: [] as { x: number; y: number; label: string; value: number }[] };
    }

    const maxValue = Math.max(...data.map((item) => item.value), 1);
    const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
    const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;

    const pointsMeta = data.map((item, index) => {
      const x = data.length > 1 ? index * step : chartWidth / 2;
      const y =
        CHART_HEIGHT - VERTICAL_PADDING - Math.max(0, Math.min(1, item.value / maxValue)) * usableHeight;

      return { x, y, label: item.label, value: item.value };
    });

    return {
      path: buildPath(pointsMeta),
      points: pointsMeta,
    };
  }, [chartWidth, data]);

  return (
    <View style={[{ width: "100%" }, style]} onLayout={handleLayout}>
      <Svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Defs>
          <LinearGradient id="spendingLineGradient" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={0.45} />
            <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>

        <Path
          d={`M0,${CHART_HEIGHT - VERTICAL_PADDING} H${chartWidth}`}
          stroke={theme.colors.border}
          strokeDasharray="4,6"
        />

        {path && (
          <>
            <Path
              d={`${path} L${chartWidth},${CHART_HEIGHT - VERTICAL_PADDING} L0,${CHART_HEIGHT - VERTICAL_PADDING} Z`}
              fill="url(#spendingLineGradient)"
              opacity={0.4}
            />
            <Path d={path} stroke={theme.colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
          </>
        )}

        {points.map((point) => (
          <SvgText
            key={`label-${point.label}`}
            x={point.x}
            y={CHART_HEIGHT - VERTICAL_PADDING + 18}
            fontSize={12}
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {point.label}
          </SvgText>
        ))}

        {points.map((point) => (
          <Circle
            key={`point-${point.label}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={theme.colors.primary}
            stroke={theme.colors.background}
            strokeWidth={1.5}
          />
        ))}
      </Svg>
    </View>
  );
};

const SpendingBarChartComponent = ({ data, style }: SpendingChartProps) => {
  const theme = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(MIN_CHART_WIDTH);
  const chartWidth = Math.max(containerWidth, MIN_CHART_WIDTH);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width && Math.round(width) !== Math.round(containerWidth)) {
        setContainerWidth(width);
      }
    },
    [containerWidth],
  );

  const bars = useMemo(() => {
    if (!data.length) {
      return [] as {
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }[];
    }

    const maxValue = Math.max(...data.map((item) => item.value), 1);
    const usableHeight = CHART_HEIGHT - VERTICAL_PADDING * 2;
    const barWidth = Math.min(32, chartWidth / (data.length * 1.6));
    const totalBarsWidth = barWidth * data.length;
    const gap = (chartWidth - totalBarsWidth) / (data.length + 1);

    return data.map((item, index) => {
      const height = Math.max(0, Math.min(1, item.value / maxValue)) * usableHeight;
      const x = gap + index * (barWidth + gap);
      const y = CHART_HEIGHT - VERTICAL_PADDING - height;

      return {
        label: item.label,
        x,
        y,
        width: barWidth,
        height,
      };
    });
  }, [chartWidth, data]);

  return (
    <View style={[{ width: "100%" }, style]} onLayout={handleLayout}>
      <Svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
        <Path
          d={`M0,${CHART_HEIGHT - VERTICAL_PADDING} H${chartWidth}`}
          stroke={theme.colors.border}
          strokeWidth={1}
        />

        {bars.map((bar) => (
          <Rect
            key={`bar-${bar.label}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={8}
            fill={theme.colors.primary}
            opacity={0.85}
          />
        ))}

        {bars.map((bar) => (
          <SvgText
            key={`bar-label-${bar.label}`}
            x={bar.x + bar.width / 2}
            y={CHART_HEIGHT - VERTICAL_PADDING + 18}
            fontSize={12}
            fill={theme.colors.textMuted}
            textAnchor="middle"
          >
            {bar.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
};

export const SpendingLineChart = memo(SpendingLineChartComponent);
export const SpendingBarChart = memo(SpendingBarChartComponent);

