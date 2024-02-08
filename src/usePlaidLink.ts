import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';
import { useScriptTag } from '@vueuse/core';
import { PLAID_LINK_STABLE_URL } from './constants';
import { PlaidSDKError } from './types/error';
import { type PlaidFactory, createPlaid } from './factory';
import type { PlaidLinkOptions } from './types';

function noop() {}

function loadPlaidSdk() {
  const isPlaidLoading = ref(true);

  const { load } = useScriptTag(
    PLAID_LINK_STABLE_URL,
    () => {
      isPlaidLoading.value = false;
    },
  );

  load();
  return { isPlaidLoading };
}

export default function usePlaidLink(options: Ref<PlaidLinkOptions>) {
  const { isPlaidLoading } = loadPlaidSdk();

  const plaid = ref<PlaidFactory | null>(null);
  const iframeLoaded = ref(false);

  watch(
    [options, isPlaidLoading],
    () => {
      if (isPlaidLoading.value) {
        return;
      }

      if (!options.value.token && !options.value.receivedRedirectUri) {
        return;
      }

      if (!window.Plaid) {
        throw new PlaidSDKError();
      }

      if (plaid.value) {
        plaid.value.exit({ force: true }, () => plaid.value?.destroy());
      }

      const next = createPlaid({
        ...options.value,
        onLoad: () => {
          iframeLoaded.value = true;
          options.value.onLoad && options.value.onLoad();
        },
      }, window.Plaid.create);

      plaid.value = next;

      return () => next.exit({ force: true }, () => next.destroy());
    },
  );

  const ready = computed(() => {
    return plaid.value != null && (!isPlaidLoading.value || iframeLoaded.value);
  });

  const exit = computed(() => plaid.value ? plaid.value.exit : noop);
  const open = computed(() => plaid.value ? plaid.value.open : noop);

  return {
    ready,
    open: open.value,
    exit: exit.value,
  };
}
