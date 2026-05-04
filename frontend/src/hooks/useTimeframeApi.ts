import { useMemo } from "react";
import { useTimeframeStore, timeframeQueryFromStore } from "@/state/timeframeStore";

export function useTimeframeApi() {
  const tf = useTimeframeStore();
  const params = useMemo(() => timeframeQueryFromStore(tf), [tf]);
  const refetchInterval: number | false = tf.autoRefresh ? 60_000 : false;
  return { params, refetchInterval, store: tf };
}
