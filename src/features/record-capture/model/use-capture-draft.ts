import { defineStore } from 'pinia';
import type { CaptureRecord } from '@fsd/entities/record/model/record-schema';

export const useCaptureDraft = defineStore('capture-draft', {
  state: () => ({
    observation: 'unchecked' as CaptureRecord['observation'],
    captureMethod: '',
    memo: '',
    os: '',
    chrome: '',
    device: '',
  }),
});
