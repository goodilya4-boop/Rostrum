import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BaseInput from '@/components/ui/BaseInput.vue';

describe('BaseInput', () => {
  it('передаёт autocomplete внутрь настоящего input', () => {
    const wrapper = mount(BaseInput, {
      props: {
        modelValue: '',
        type: 'password',
        autocomplete: 'current-password',
      },
    });

    expect(wrapper.get('input').attributes('autocomplete')).toBe('current-password');
    wrapper.unmount();
  });

  it('показывает и снова скрывает пароль', async () => {
    const wrapper = mount(BaseInput, {
      props: { modelValue: 'secret-password', type: 'password' },
    });

    expect(wrapper.get('input').attributes('type')).toBe('password');
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('input').attributes('type')).toBe('text');
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('input').attributes('type')).toBe('password');
    wrapper.unmount();
  });
});
