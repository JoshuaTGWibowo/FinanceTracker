import { SafeAreaView } from "react-native-safe-area-context";

import { FlowDetailsScreen } from "../../components/FlowDetailsScreen";

export default function ExpenseDetailsRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlowDetailsScreen flowType="expense" />
    </SafeAreaView>
  );
}
