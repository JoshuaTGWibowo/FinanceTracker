import { useMemo } from "react";
import Svg, { Circle, Path } from "react-native-svg";

import { useAppTheme } from "../theme";

export interface CategorySlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export const CATEGORY_PALETTE = [
  "#60A5FA",
  "#34D399",
  "#F97316",
  "#F472B6",
  "#A78BFA",
  "#FB7185",
  "#FBBF24",
];

const polarToCartesian = (center: number, radius: number, angle: number) => ({
  x: center + radius * Math.cos(angle),
  y: center + radius * Math.sin(angle),
});

const describeArc = (
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const start = polarToCartesian(center, radius, startAngle);
  const end = polarToCartesian(center, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;

  return [
    `M ${center} ${center}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

export const CategoryPieChart = ({
  data,
  size = 140,
}: {
  data: CategorySlice[];
  size?: number;
}) => {
  const theme = useAppTheme();
  const radius = size / 2;

  const segments = useMemo(() => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    let startAngle = -Math.PI / 2;

    if (!total) {
      return [] as { path: string; color: string }[];
    }

    return data.map((item) => {
      const angle = (item.value / total) * Math.PI * 2;
      const path = describeArc(radius, radius, startAngle, startAngle + angle);
      startAngle += angle;
      return { path, color: item.color };
    });
  }, [data, radius]);

  return (
    <Svg width={size} height={size}>
      {segments.length === 0 ? (
        <Circle cx={radius} cy={radius} r={radius} fill={`${theme.colors.border}55`} />
      ) : (
        segments.map((segment, index) => <Path key={index} d={segment.path} fill={segment.color} />)
      )}
      <Circle cx={radius} cy={radius} r={radius * 0.55} fill={theme.colors.surface} />
    </Svg>
  );
};
