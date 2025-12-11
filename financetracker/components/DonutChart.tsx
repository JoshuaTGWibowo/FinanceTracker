import { memo, useMemo } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { G, Path, Circle, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "../theme";

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  style?: ViewStyle;
}

const RADIUS = 60;
const STROKE_WIDTH = 22;

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  // Handle full circle case (or nearly full)
  if (endAngle - startAngle >= 359.99) {
    // For a full circle, we need to draw two half-circles
    const mid = polarToCartesian(x, y, radius, startAngle + 180);
    const start = polarToCartesian(x, y, radius, startAngle);
    return [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 1 1 ${mid.x} ${mid.y}`,
      `A ${radius} ${radius} 0 1 1 ${start.x} ${start.y}`,
    ].join(" ");
  }

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [`M ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`].join(" ");
};

const DonutChartComponent = ({ data, style }: DonutChartProps) => {
  const theme = useAppTheme();

  const { segments, total } = useMemo(() => {
    // Filter out zero/negative values
    const validData = data.filter(item => item.value > 0);
    const totalValue = validData.reduce((acc, item) => acc + item.value, 0);
    
    if (totalValue === 0 || validData.length === 0) {
      return { segments: [], total: 0 };
    }

    let cumulativeAngle = 0;

    const colorPalette = [
      theme.colors.primary,
      theme.colors.accent,
      theme.colors.success,
      theme.colors.danger,
      theme.colors.primaryMuted,
    ];

    const segments = validData.map((item, index) => {
      const normalizedValue = item.value / totalValue;
      const startAngle = cumulativeAngle;
      // Ensure the last segment ends exactly at 360 degrees
      const isLastSegment = index === validData.length - 1;
      const sweepAngle = isLastSegment 
        ? 360 - startAngle  // Force last segment to complete the circle
        : normalizedValue * 360;
      cumulativeAngle += sweepAngle;

      const color = item.color ?? colorPalette[index % colorPalette.length];

      return {
        label: item.label,
        value: item.value,
        percentage: normalizedValue,
        path: describeArc(RADIUS + STROKE_WIDTH, RADIUS + STROKE_WIDTH, RADIUS, startAngle, startAngle + sweepAngle),
        color,
        startAngle,
        sweepAngle,
      };
    });

    return { segments, total: totalValue };
  }, [data, theme.colors]);

  return (
    <View style={style}>
      <Svg width={(RADIUS + STROKE_WIDTH) * 2} height={(RADIUS + STROKE_WIDTH) * 2}>
        <G rotation={-90} origin={`${RADIUS + STROKE_WIDTH}, ${RADIUS + STROKE_WIDTH}`}>
          {segments.map((segment) => (
            <Path
              key={segment.label}
              d={segment.path}
              stroke={segment.color}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="butt"
              strokeLinejoin="round"
              strokeOpacity={1}
            />
          ))}
        </G>
        <SvgText
          x={RADIUS + STROKE_WIDTH}
          y={RADIUS + STROKE_WIDTH - 4}
          fontSize={20}
          fontWeight="700"
          fill={theme.colors.text}
          textAnchor="middle"
        >
          {total ? Math.round(total).toLocaleString() : "0"}
        </SvgText>
        <SvgText
          x={RADIUS + STROKE_WIDTH}
          y={RADIUS + STROKE_WIDTH + 16}
          fontSize={12}
          fill={theme.colors.textMuted}
          textAnchor="middle"
        >
          total spend
        </SvgText>
      </Svg>
    </View>
  );
};

export const DonutChart = memo(DonutChartComponent);
