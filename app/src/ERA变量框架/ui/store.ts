import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { EraPublicState } from '../service/public-api';

export type SidecarBindingPrompt = Readonly<{
  kind: 'conflict' | 'repair';
  sidecarId: string | null;
  current: Readonly<Record<string, unknown>> | null;
  owner: Readonly<Record<string, unknown>> | null;
  revision: number | null;
  reason?: string;
}>;

export const useUiStore = defineStore('ui', () => {
  const currentView = ref<'FloatingBall' | 'ExpandedView'>('FloatingBall');
  const eventData = ref<EraPublicState | null>(null);
  const sidecarBindingPrompt = ref<SidecarBindingPrompt | null>(null);

  function switchView(viewName: 'FloatingBall' | 'ExpandedView') {
    if (currentView.value !== viewName) {
      currentView.value = viewName;
    }
  }

  function setEventData(data: EraPublicState | null) {
    eventData.value = data;
  }

  function setSidecarBindingPrompt(prompt: SidecarBindingPrompt | null) {
    sidecarBindingPrompt.value = prompt;
  }

  return {
    currentView,
    eventData,
    sidecarBindingPrompt,
    switchView,
    setEventData,
    setSidecarBindingPrompt,
  };
});
