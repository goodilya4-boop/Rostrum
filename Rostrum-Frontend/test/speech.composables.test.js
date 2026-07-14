import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWebSpeechRecognition } from '@/composables/useWebSpeechRecognition';
import { useVoskRecorder } from '@/composables/useVoskRecorder';

let wrapper;

function mountComposable(factory) {
  let api;
  wrapper = mount(defineComponent({
    setup() {
      api = factory();
      return () => h('div');
    },
  }));
  return api;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.useRealTimers();
});

describe('useWebSpeechRecognition', () => {
  it('преобразует только финальный результат в API-сегмент', async () => {
    class FakeRecognition {
      static instance;
      constructor() { FakeRecognition.instance = this; }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true, writable: true, value: FakeRecognition,
    });
    const onFinalSegments = vi.fn();
    const getElapsedMs = vi.fn().mockReturnValueOnce(4000).mockReturnValueOnce(5000);
    const api = mountComposable(() => useWebSpeechRecognition({
      getElapsedMs,
      onFinalSegments,
      idPrefix: 'test',
    }));

    expect(api.start()).toBe(true);
    FakeRecognition.instance.onspeechstart();
    FakeRecognition.instance.onresult({
      resultIndex: 0,
      results: [{
        0: { transcript: '  Проверка распознавания  ', confidence: 0.8 },
        isFinal: true,
      }],
    });
    await flushPromises();

    expect(onFinalSegments).toHaveBeenCalledOnce();
    const [segment] = onFinalSegments.mock.calls[0][0];
    expect(segment.segment_id).toMatch(/^test-/);
    expect(segment.spoken_text).toBe('Проверка распознавания');
    expect(segment.start_ms).toBe(4000);
    expect(segment.end_ms).toBe(5000);
    expect(segment.confidence).toBe(0.8);
    expect(api.lastFinalText.value).toBe('Проверка распознавания');
  });

  it('не отправляет промежуточный текст', async () => {
    class FakeRecognition {
      static instance;
      constructor() { FakeRecognition.instance = this; }
      start() { this.onstart?.(); }
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true, writable: true, value: FakeRecognition,
    });
    const onFinalSegments = vi.fn();
    const api = mountComposable(() => useWebSpeechRecognition({
      getElapsedMs: () => 1000,
      onFinalSegments,
    }));

    api.start();
    FakeRecognition.instance.onresult({
      resultIndex: 0,
      results: [{ 0: { transcript: 'черновой текст', confidence: 0 }, isFinal: false }],
    });
    await flushPromises();

    expect(api.interimText.value).toBe('черновой текст');
    expect(onFinalSegments).not.toHaveBeenCalled();
  });

  it('останавливается после запрета микрофона и сообщает понятную ошибку', () => {
    class FakeRecognition {
      static instance;
      constructor() { FakeRecognition.instance = this; }
      start() { this.onstart?.(); }
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true, writable: true, value: FakeRecognition,
    });
    const api = mountComposable(() => useWebSpeechRecognition({ getElapsedMs: () => 0 }));

    api.start();
    FakeRecognition.instance.onerror({ error: 'not-allowed' });

    expect(api.permissionDenied.value).toBe(true);
    expect(api.error.value).toContain('Доступ к микрофону запрещён');
  });
});

describe('useVoskRecorder', () => {
  it('создаёт автономный чанк поддерживаемого типа и сохраняет последний фрагмент', async () => {
    const stopTrack = vi.fn();
    const stream = { active: true, getTracks: () => [{ stop: stopTrack }] };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    class FakeMediaRecorder {
      static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
      constructor(inputStream, options) {
        expect(inputStream).toBe(stream);
        this.mimeType = options.mimeType;
        this.state = 'inactive';
      }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        queueMicrotask(() => {
          this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: this.mimeType }) });
          this.onstop?.();
        });
      }
    }
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true, writable: true, value: FakeMediaRecorder,
    });
    const onChunk = vi.fn();
    const getElapsedMs = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(1250);
    const api = mountComposable(() => useVoskRecorder({
      getElapsedMs,
      getAcceptedMimeTypes: () => ['audio/webm'],
      onChunk,
      chunkDurationMs: 10000,
    }));

    expect(await api.start()).toBe(true);
    expect(api.recording.value).toBe(true);
    await api.stop();
    await flushPromises();

    expect(onChunk).toHaveBeenCalledOnce();
    const chunk = onChunk.mock.calls[0][0];
    expect(chunk.blob).toBeInstanceOf(Blob);
    expect(chunk.blob.type).toBe('audio/webm');
    expect(chunk.offsetMs).toBe(100);
    expect(chunk.durationMs).toBe(1150);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(api.recording.value).toBe(false);
  });

  it('обрабатывает отказ в доступе к микрофону', async () => {
    const denied = new Error('Permission denied');
    denied.name = 'NotAllowedError';
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(denied) },
    });
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
    }
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true, writable: true, value: FakeMediaRecorder,
    });
    const api = mountComposable(() => useVoskRecorder({
      getElapsedMs: () => 0,
      getAcceptedMimeTypes: () => ['audio/webm'],
    }));

    expect(await api.start()).toBe(false);
    expect(api.permissionDenied.value).toBe(true);
    expect(api.error.value).toContain('Доступ к микрофону запрещён');
  });
});
