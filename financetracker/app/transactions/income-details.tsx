import { SafeAreaView } from "react-native-safe-area-context";

import { FlowDetailsScreen } from "../../components/FlowDetailsScreen";

export default function IncomeDetailsRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlowDetailsScreen flowType="income" />
    </SafeAreaView>
  );
}
