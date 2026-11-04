import { appAlert, confirmDialog, inferTone, toast, useDialogStore } from '../dialogStore';

beforeEach(() => useDialogStore.setState({ queue: [], toast: null }));

describe('in-app dialogs', () => {
  it('infers a tone from the buttons and title', () => {
    expect(inferTone('Delete page?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive' }])).toBe('danger');
    expect(inferTone('Could not save PDF', [{ text: 'OK' }])).toBe('error');
    expect(inferTone('Restore original?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore' }])).toBe('question');
    expect(inferTone('Folder locked', [{ text: 'OK' }])).toBe('info');
  });

  it('queues dialogs and adds an OK button when none is given', () => {
    appAlert('First');
    appAlert('Second', 'Details');
    const { queue } = useDialogStore.getState();
    expect(queue.map((d) => d.title)).toEqual(['First', 'Second']);
    expect(queue[0].buttons).toEqual([{ text: 'OK' }]);
  });

  it('resolves confirmDialog with the chosen button', async () => {
    const answer = confirmDialog({ title: 'Discard?', confirmLabel: 'Discard', destructive: true });
    const dialog = useDialogStore.getState().queue[0];
    expect(dialog.tone).toBe('danger');
    dialog.buttons.find((b) => b.text === 'Discard')?.onPress?.();
    await expect(answer).resolves.toBe(true);
  });

  it('shows a toast', () => {
    toast('Copied');
    expect(useDialogStore.getState().toast).toMatchObject({ message: 'Copied', tone: 'success' });
  });
});
